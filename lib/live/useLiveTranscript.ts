"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speech capture for Live Mode.
 *
 * Primary path is the browser's own `SpeechRecognition`, which recognises
 * in-page: no audio leaves the device, and it is free and unmetered, which is
 * why it is primary rather than a fallback. Browsers without it record three
 * second chunks and post them to Whisper, where they are transcribed and
 * dropped.
 *
 * The rolling window lives in this ref and nowhere else. It is never written
 * to storage, never put in React state that could be serialised into a
 * server payload, and it is cleared when the session stops.
 */

export type TranscriptSource = "browser" | "whisper" | "none";

const WINDOW_SECONDS = 30;
const CHUNK_MS = 3000;

interface Utterance {
  at: number;
  text: string;
}

export interface LiveTranscript {
  supported: boolean;
  source: TranscriptSource;
  listening: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** The last 30 seconds of text. Reading it does not persist it. */
  readWindow: () => string;
}

export function useLiveTranscript(language: string): LiveTranscript {
  const [listening, setListening] = useState(false);
  const [source, setSource] = useState<TranscriptSource>("none");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const utterancesRef = useRef<Utterance[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition),
    );
  }, []);

  const push = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    utterancesRef.current.push({ at: now, text: trimmed });
    // Drop anything older than the window. This is the only retention.
    utterancesRef.current = utterancesRef.current.filter(
      (u) => now - u.at <= WINDOW_SECONDS * 1000,
    );
  }, []);

  const readWindow = useCallback((): string => {
    const cutoff = Date.now() - WINDOW_SECONDS * 1000;
    return utterancesRef.current
      .filter((u) => u.at >= cutoff)
      .map((u) => u.text)
      .join(" ")
      .slice(-2000);
  }, []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    setListening(false);

    recognitionRef.current?.stop();
    recognitionRef.current = null;

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    // The window goes with the session. Nothing is kept.
    utterancesRef.current = [];
  }, []);

  const startWhisperFallback = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size === 0) return;
      const form = new FormData();
      form.append("audio", event.data, "chunk.webm");
      try {
        const response = await fetch("/api/live/transcribe", { method: "POST", body: form });
        const data = (await response.json()) as { text?: string };
        if (data.text) push(data.text);
      } catch {
        // A dropped chunk is a gap in coaching, not a failure worth surfacing.
      }
    };

    recorder.start(CHUNK_MS);
    setSource("whisper");
    setListening(true);
  }, [push]);

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    stoppingRef.current = false;

    const Recognition =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined;

    if (Recognition) {
      try {
        const recognition = new Recognition();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            const alternative = result[0];
            if (alternative) push(alternative.transcript);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setError("denied");
            stop();
          }
          // `no-speech` and `aborted` are routine during a homework session.
        };

        recognition.onend = () => {
          // Browsers stop recognition after a silence. Restart unless the
          // parent actually asked us to stop.
          if (!stoppingRef.current) {
            try {
              recognition.start();
            } catch {
              setListening(false);
            }
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setSource("browser");
        setListening(true);
        return;
      } catch {
        // Fall through to the chunked fallback.
      }
    }

    try {
      await startWhisperFallback();
    } catch {
      setError("denied");
      setListening(false);
    }
  }, [language, push, stop, startWhisperFallback]);

  useEffect(() => () => stop(), [stop]);

  return { supported, source, listening, error, start, stop, readWindow };
}
