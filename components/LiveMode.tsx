"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import CompassDraw from "@/components/CompassDraw";
import { Banner, buttonStyle, Page } from "@/components/ui";
import { copy } from "@/lib/copy";
import { initialLiveState, type LiveState } from "@/lib/live/rules";
import { useLiveTranscript } from "@/lib/live/useLiveTranscript";
import type { ClassifyResponse } from "@/app/api/live/classify/route";
import type { EndSessionResponse } from "@/app/api/session/[id]/end/route";

const CLASSIFY_INTERVAL_MS = 5000;

interface ActiveCard {
  id: string;
  text: string;
}

/**
 * Live Mode.
 *
 * The default visual state is empty: a slowly breathing compass mark, a
 * timer, and nothing else. No waveform, no transcript on screen, no running
 * commentary. The restraint is the design, and it is also the honest
 * representation of what is happening, since nothing is being kept.
 */
export default function LiveMode({ language }: { language: string }) {
  const router = useRouter();
  const transcript = useLiveTranscript(language);
  // The hook returns a fresh object every render and the timer below re-renders
  // once a second, so effects must depend on these stable callbacks rather than
  // on `transcript`. Depending on the object tore down the 5 second classify
  // interval every second, and it never fired.
  const { listening, readWindow, stop: stopTranscript } = transcript;

  const [elapsed, setElapsed] = useState(0);
  const [card, setCard] = useState<ActiveCard | null>(null);
  const [parked, setParked] = useState(false);
  const [teacherNote, setTeacherNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [cardsSpent, setCardsSpent] = useState(false);
  // Opened when the parent actually starts listening, not on page load.
  const [sessionId, setSessionId] = useState<string | null>(null);

  const stateRef = useRef<LiveState>(initialLiveState());
  const startedAtRef = useRef<number>(Date.now());

  const endSession = useCallback(
    async (wasParked: boolean) => {
      setEnding(true);
      stopTranscript();

      if (!sessionId) {
        router.push("/recap/none");
        return;
      }

      try {
        const response = await fetch(`/api/session/${sessionId}/end`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ parked: wasParked }),
        });
        const data = (await response.json()) as EndSessionResponse;
        if (data.teacherNote) setTeacherNote(data.teacherNote);
      } catch {
        // The recap page recomputes from stored moves, so a failed end call
        // costs the drafted note, not the session.
      }

      if (!wasParked) router.push(`/recap/${sessionId}`);
      else setEnding(false);
    },
    [router, sessionId, stopTranscript],
  );

  const beginSession = useCallback(async (): Promise<void> => {
    await transcript.start();
    startedAtRef.current = Date.now();
    try {
      const response = await fetch("/api/session", { method: "POST" });
      const data = (await response.json()) as { sessionId: string | null };
      setSessionId(data.sessionId);
    } catch {
      // Without a session id the coaching still works, it just is not recorded.
      setSessionId(null);
    }
  }, [transcript]);

  // The timer, and the only thing on screen that moves.
  useEffect(() => {
    if (!listening) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  // Classify the rolling window every five seconds.
  useEffect(() => {
    if (!listening || parked) return;

    const timer = window.setInterval(async () => {
      const windowText = readWindow();
      const tOffset = Math.floor((Date.now() - startedAtRef.current) / 1000);

      try {
        const response = await fetch("/api/live/classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            window: windowText,
            tOffset,
            sessionId,
            state: stateRef.current,
          }),
        });
        if (!response.ok) return;

        const data = (await response.json()) as ClassifyResponse;
        stateRef.current = data.state;

        if (data.card) setCard({ id: data.card.id, text: data.card.text });
        if (data.state.cardsShown >= 3) setCardsSpent(true);

        if (data.park) {
          setParked(true);
          void endSession(true);
        }
      } catch {
        // A dropped classification is one missed window. The next one is five
        // seconds away, and interrupting the parent to say so would be worse.
      }
    }, CLASSIFY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [listening, readWindow, parked, sessionId, endSession]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  if (parked) {
    return (
      <Page>
        <section
          style={{
            marginTop: 48,
            border: `1px solid var(--alert)`,
            borderTop: `4px solid var(--alert)`,
            padding: "28px 24px",
          }}
        >
          <h1 style={{ color: "var(--alert)", fontSize: "1.9rem", marginBottom: 16 }}>
            {copy.live.parkHeading}
          </h1>
          <p style={{ fontSize: 17 }}>{copy.live.parkBody}</p>
        </section>

        {teacherNote ? (
          <section style={{ borderTop: "1px solid var(--rule)", marginTop: 30, paddingTop: 26 }}>
            <h2 style={{ fontSize: "1.25rem", marginBottom: 14 }}>{copy.live.parkNoteHeading}</h2>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 17 }}>{teacherNote}</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(teacherNote);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              style={{ ...buttonStyle("secondary"), marginTop: 20 }}
            >
              {copied ? copy.live.parkCopied : copy.live.parkCopy}
            </button>
          </section>
        ) : (
          ending && <p style={{ marginTop: 26, color: "var(--muted)" }}>{copy.common.loading}</p>
        )}

        <div style={{ marginTop: 36, borderTop: "1px solid var(--rule)", paddingTop: 22 }}>
          <button
            type="button"
            onClick={() => router.push(sessionId ? `/recap/${sessionId}` : "/recap/none")}
            style={buttonStyle("primary", true)}
          >
            {copy.recap.heading}
          </button>
        </div>
      </Page>
    );
  }

  if (!listening) {
    return (
      <Page>
        <header style={{ padding: "48px 0 22px" }}>
          <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{copy.live.heading}</h1>
          <p style={{ marginTop: 16, fontSize: 17 }}>{copy.live.intro}</p>
          {!transcript.supported && <Banner text={copy.live.unsupported} />}
          {transcript.error === "denied" && <Banner tone="alert" text={copy.live.micDenied} />}
        </header>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 26 }}>
          <button type="button" onClick={beginSession} style={buttonStyle("primary", true)}>
            {copy.live.micPrompt}
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div
        style={{
          minHeight: "58vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
        }}
      >
        <CompassDraw mode="breathe" size={96} />

        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 40,
            color: "var(--teal)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {minutes}:{seconds}
        </p>

        <p style={{ fontSize: 14, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {copy.live.listening}
        </p>

        {cardsSpent && (
          <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center", maxWidth: 340 }}>
            {copy.live.cardsSpent}
          </p>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 20 }}>
        <button
          type="button"
          onClick={() => void endSession(false)}
          disabled={ending}
          style={buttonStyle("quiet", true)}
        >
          {ending ? copy.common.loading : copy.live.stop}
        </button>
      </div>

      {card && (
        <div className="pp-live-card pp-rise" role="status">
          <p style={{ fontSize: 17, marginBottom: 18 }}>{card.text}</p>
          <button type="button" onClick={() => setCard(null)} style={buttonStyle("secondary", true)}>
            {copy.live.cardDismiss}
          </button>
        </div>
      )}
    </Page>
  );
}
