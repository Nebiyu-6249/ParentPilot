"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Press to talk, and the reply read back.
 *
 * Stage one: `MediaRecorder` while the button is held, one Whisper call on
 * release, the existing thread pipeline for the turn itself, one synthesis
 * call for the answer. No Realtime API, no streaming audio, no barge in. The
 * whole loop is four round trips a parent can hear happening, which is worse
 * latency than a realtime socket and is also four places where the overheard
 * check can sit. That trade is the right way round for this product.
 *
 * Nothing here holds a transcript. The recorded blob is posted and dropped,
 * the returned text goes straight out through `onTranscript` into the thread,
 * and the audio element gets an object URL that is revoked when it ends.
 * There is no state in this file that a devtools inspector could read a
 * conversation out of.
 */

export type VoicePhase = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

export interface VoiceMode {
  supported: boolean;
  phase: VoicePhase;
  /** Set when the microphone was refused or a step failed. Shown once. */
  error: string | null;
  /** Press and hold. */
  begin: () => Promise<void>;
  /** Release. */
  end: () => Promise<void>;
  /** Stops playback and closes the mic, for the stop control. */
  cancel: () => void;
  /** Called by the thread once a reply has been committed. */
  speakReply: (args: { writtenReply: string; problemId: string | null }) => Promise<void>;
  keepListening: boolean;
  setKeepListening: (on: boolean) => void;
  childCanHear: boolean;
  setChildCanHear: (on: boolean) => void;
}

/** How long the mic stays open after a reply, when keep listening is on. */
const KEEP_OPEN_MS = 4000;

/** A hold shorter than this is a mis-tap rather than a question. */
const MIN_HOLD_MS = 350;

export interface VoiceModeOptions {
  register: string;
  /** Receives the transcribed text. The thread submits it as a parent turn. */
  onTranscript: (text: string) => void;
  strings: {
    micDenied: string;
    unsupported: string;
    nothingHeard: string;
    failed: string;
  };
}

export function useVoiceMode(options: VoiceModeOptions): VoiceMode {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [keepListening, setKeepListening] = useState(false);
  /* Default on. The safer state is the default, and a parent who wants the
     franker version has to say so rather than discover it by accident. */
  const [childCanHear, setChildCanHear] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const keepTimerRef = useRef<number | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  // Nothing survives the component. A page that navigates away mid-reply
  // leaves neither an open microphone nor a playing voice.
  useEffect(() => {
    return () => {
      if (keepTimerRef.current) window.clearTimeout(keepTimerRef.current);
      releaseStream();
      releaseAudio();
    };
  }, [releaseStream, releaseAudio]);

  const begin = useCallback(async (): Promise<void> => {
    if (!supported) {
      setError(optionsRef.current.strings.unsupported);
      return;
    }
    if (keepTimerRef.current) {
      window.clearTimeout(keepTimerRef.current);
      keepTimerRef.current = null;
    }
    // A new question interrupts the previous answer, which is what happens
    // when two people talk.
    releaseAudio();
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setPhase("recording");
    } catch {
      setError(optionsRef.current.strings.micDenied);
      setPhase("idle");
      releaseStream();
    }
  }, [supported, releaseAudio, releaseStream]);

  const end = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setPhase("idle");
      return;
    }

    const held = Date.now() - startedAtRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.stop();
    });
    releaseStream();

    if (held < MIN_HOLD_MS || blob.size === 0) {
      setPhase("idle");
      return;
    }

    setPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "utterance.webm");
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const data = (await response.json()) as { text?: string; error?: string };

      if (!data.text) {
        setError(data.error ?? optionsRef.current.strings.nothingHeard);
        setPhase("idle");
        return;
      }

      setPhase("thinking");
      optionsRef.current.onTranscript(data.text);
    } catch {
      setError(optionsRef.current.strings.failed);
      setPhase("idle");
    }
  }, [releaseStream]);

  const cancel = useCallback((): void => {
    if (keepTimerRef.current) {
      window.clearTimeout(keepTimerRef.current);
      keepTimerRef.current = null;
    }
    releaseStream();
    releaseAudio();
    setPhase("idle");
  }, [releaseStream, releaseAudio]);

  /**
   * Reads a committed reply back.
   *
   * The written turn is already on screen by the time this runs, which is the
   * point: a parent who does not want to wait for the voice can read it, and
   * a rendering that fails its check on the server costs them nothing they
   * were not already given.
   */
  const speakReply = useCallback(
    async (args: { writtenReply: string; problemId: string | null }): Promise<void> => {
      setPhase("speaking");
      try {
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            writtenReply: args.writtenReply,
            problemId: args.problemId,
            register: optionsRef.current.register,
            childCanHear,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? optionsRef.current.strings.failed);
          setPhase("idle");
          return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        });

        releaseAudio();

        if (keepListening) {
          /* Open again, briefly, so a follow up does not need the button.
             Bounded rather than open ended: a microphone that stays on until
             something happens is a microphone nobody is sure is off. */
          void begin();
          keepTimerRef.current = window.setTimeout(() => {
            void end();
          }, KEEP_OPEN_MS);
        } else {
          setPhase("idle");
        }
      } catch {
        setError(optionsRef.current.strings.failed);
        setPhase("idle");
      }
    },
    [childCanHear, keepListening, begin, end, releaseAudio],
  );

  return {
    supported,
    phase,
    error,
    begin,
    end,
    cancel,
    speakReply,
    keepListening,
    setKeepListening,
    childCanHear,
    setChildCanHear,
  };
}
