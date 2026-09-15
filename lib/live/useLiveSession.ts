"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/lib/copy";
import { initialLiveState, type LiveState } from "@/lib/live/rules";
import { useLiveTranscript } from "@/lib/live/useLiveTranscript";
import type { Card } from "@/lib/thread";
import type { ClassifyResponse } from "@/app/api/live/classify/route";
import type { EndSessionResponse } from "@/app/api/session/[id]/end/route";

/**
 * Live Mode, as a session the thread can hold.
 *
 * Everything that used to be the `/live` screen is here except the rendering:
 * open a session, classify the rolling window every five seconds, raise a card
 * when the rules say so, and write a summary when it stops. The thread decides
 * what any of that looks like.
 *
 * The privacy invariant is unchanged and is the reason this is a hook rather
 * than a component that could accidentally render what it hears. The window
 * lives in a ref inside `useLiveTranscript`, is read into a local, posted, and
 * dropped. Nothing here puts it in React state, and there is no state in this
 * file that a devtools inspector could read the words out of.
 */

const CLASSIFY_INTERVAL_MS = 5000;

export interface LiveSession {
  supported: boolean;
  listening: boolean;
  /** Seconds since the parent started, for the composer's indicator. */
  elapsed: number;
  /** Set when the microphone was refused, so the thread can say so once. */
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * @param emit appends an assistant turn to the thread. Called for a coaching
 *   card, for a Park It, and for the closing summary.
 */
export function useLiveSession(language: string, emit: (cards: Card[]) => void): LiveSession {
  const transcript = useLiveTranscript(language);
  // `useLiveTranscript` returns a fresh object each render and the timer below
  // re-renders once a second, so the effects depend on these stable callbacks.
  // Depending on the object tore down the five second interval every second and
  // it never fired, which is a bug this file inherited and must not reintroduce.
  const { listening, readWindow, stop: stopTranscript } = transcript;

  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const stateRef = useRef<LiveState>(initialLiveState());
  const startedAtRef = useRef<number>(Date.now());
  const emitRef = useRef(emit);
  const endingRef = useRef(false);

  // The thread re-renders constantly; the callback it passes must not restart
  // the classify interval each time.
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  const finish = useCallback(
    async (parked: boolean): Promise<void> => {
      if (endingRef.current) return;
      endingRef.current = true;

      stopTranscript();
      const minutes = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000));

      if (!sessionId) {
        // Nothing was recorded, so there is nothing to summarise. Saying so is
        // better than a summary of zero.
        emitRef.current([{ kind: "text", body: copy.live.nothingRecorded }]);
        endingRef.current = false;
        return;
      }

      try {
        const response = await fetch(`/api/session/${sessionId}/end`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ parked }),
        });
        const data = (await response.json()) as EndSessionResponse;

        const cards: Card[] = [];
        if (parked) {
          cards.push({ kind: "park_it", reason: "escalation", teacherNote: data.teacherNote });
        }
        cards.push({
          kind: "live_summary",
          autonomyScore: data.autonomyScore,
          reading: data.reading,
          moveCounts: data.moveCounts,
          minutes,
        });
        emitRef.current(cards);
      } catch {
        emitRef.current([{ kind: "text", body: copy.live.summaryFailed }]);
      } finally {
        setSessionId(null);
        setElapsed(0);
        stateRef.current = initialLiveState();
        endingRef.current = false;
      }
    },
    [sessionId, stopTranscript],
  );

  const start = useCallback(async (): Promise<void> => {
    await transcript.start();
    startedAtRef.current = Date.now();
    setElapsed(0);
    stateRef.current = initialLiveState();

    try {
      const response = await fetch("/api/session", { method: "POST" });
      const data = (await response.json()) as { sessionId: string | null };
      setSessionId(data.sessionId);
    } catch {
      // Without a session id the coaching still works, it just is not recorded.
      setSessionId(null);
    }
  }, [transcript]);

  const stop = useCallback(() => finish(false), [finish]);

  // The clock, for the indicator in the composer.
  useEffect(() => {
    if (!listening) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  // One classification every five seconds, for as long as it is listening.
  useEffect(() => {
    if (!listening) return;

    const timer = window.setInterval(async () => {
      const windowText = readWindow();
      const tOffset = Math.floor((Date.now() - startedAtRef.current) / 1000);

      try {
        const response = await fetch("/api/live/classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ window: windowText, tOffset, sessionId, state: stateRef.current }),
        });
        if (!response.ok) return;

        const data = (await response.json()) as ClassifyResponse;
        stateRef.current = data.state;

        if (data.card) {
          emitRef.current([
            {
              kind: "live_coach",
              triggerLabel: data.card.triggerLabel,
              body: data.card.text,
              tOffset: data.card.tOffset,
            },
          ]);
        }

        if (data.park) void finish(true);
      } catch {
        // A dropped classification is one missed window. The next one is five
        // seconds away, and interrupting the parent to say so would be worse.
      }
    }, CLASSIFY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [listening, readWindow, sessionId, finish]);

  return {
    supported: transcript.supported,
    listening,
    elapsed,
    error: transcript.error,
    start,
    stop,
  };
}
