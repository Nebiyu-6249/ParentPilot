"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/lib/copy";

const HOLD_MS = 1500;

/**
 * The answer, behind a 1.5 second press and hold.
 *
 * The hold is not a gimmick. Reaching for the answer is the single easiest
 * thing a tired parent can do at 8pm, and it is also the one action that
 * ends the learning for that problem. A second and a half is long enough to
 * be a decision rather than a reflex, and short enough not to be a punishment
 * when the parent genuinely needs it.
 *
 * When our own arithmetic disagrees with the model, there is no hold and no
 * answer: the answer is suppressed entirely.
 */
export default function LockedAnswer({
  answer,
  verification,
}: {
  answer: string;
  verification: "checked" | "unverified" | "not-applicable";
}) {
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const holdingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const stop = useCallback(() => {
    holdingRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    if (!holdingRef.current) return;
    const elapsed = performance.now() - startRef.current;
    const next = Math.min(elapsed / HOLD_MS, 1);
    setProgress(next);

    if (next >= 1) {
      holdingRef.current = false;
      frameRef.current = null;
      setRevealed(true);
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    if (revealed || holdingRef.current) return;
    holdingRef.current = true;
    startRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tick);
  }, [revealed, tick]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  if (verification === "unverified") {
    return (
      <div style={{ border: "1px solid var(--alert)", padding: "18px 20px" }}>
        <Badge tone="alert">{copy.packet.unverifiedBadge}</Badge>
        <p style={{ marginTop: 12, fontSize: 17 }}>{copy.packet.unverifiedHelp}</p>
      </div>
    );
  }

  if (revealed) {
    return (
      <div className="pp-settle" style={{ border: "1px solid var(--rule)", padding: "18px 20px" }}>
        {verification === "checked" && <Badge tone="ok">{copy.packet.verifiedBadge}</Badge>}
        <p style={{ marginTop: verification === "checked" ? 12 : 0, fontSize: 19 }}>{answer}</p>
        {verification === "checked" && (
          <p style={{ marginTop: 10, fontSize: 14, color: "var(--muted)" }}>{copy.packet.verifiedHelp}</p>
        )}
      </div>
    );
  }

  const pct = Math.round(progress * 100);

  return (
    <div>
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(event) => {
          if (event.repeat) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            start();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") stop();
        }}
        aria-label={copy.packet.answerHold}
        style={{
          position: "relative",
          width: "100%",
          padding: "18px 20px",
          border: "1px solid var(--teal)",
          background: "transparent",
          color: "var(--teal)",
          fontSize: 17,
          fontWeight: 500,
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            background: "var(--emerald)",
            opacity: 0.22,
          }}
        />
        <span style={{ position: "relative" }}>
          {progress > 0 ? copy.packet.answerHolding : copy.packet.answerHold}
        </span>
      </button>
      <p style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>{copy.packet.answerWhy}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: string; tone: "ok" | "alert" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 9px",
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        border: `1px solid ${tone === "ok" ? "var(--emerald)" : "var(--alert)"}`,
        color: tone === "ok" ? "var(--emerald)" : "var(--alert)",
      }}
    >
      {children}
    </span>
  );
}
