"use client";

import CompassDraw from "@/components/CompassDraw";

/**
 * The loading state.
 *
 * A status line naming the step that is actually happening, under the same
 * compass star from the intro, slowed and looping. Never a spinner, never a
 * skeleton: a skeleton implies the shape of the result is known and only the
 * pixels are missing, which is a lie during a 20 second model call.
 */
export default function StatusLine({ step }: { step: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        padding: "56px 0",
      }}
    >
      <CompassDraw mode="loop" size={72} durationMs={2200} />
      <p style={{ color: "var(--muted)", fontSize: 17, textAlign: "center" }}>
        {step}
        <span aria-hidden="true">…</span>
      </p>
    </div>
  );
}
