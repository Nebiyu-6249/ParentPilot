"use client";

import type { ReactNode } from "react";

import { ChevronIcon } from "@/components/icons";

/**
 * A closed-by-default section.
 *
 * Built on `<details>` rather than a button and a state hook, so it opens
 * without JavaScript, is keyboard operable for free, and is findable by the
 * browser's own in-page search even while collapsed. That last one matters:
 * a parent searching for "denominator" should still land on the right section.
 */
export default function Disclosure({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  /** `quiet` is used for the answer, which should not invite a tap. */
  tone?: "default" | "quiet";
}) {
  return (
    <details
      style={{
        borderTop: "1px solid var(--rule-on-sheet)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 2px",
          fontSize: tone === "quiet" ? "var(--type-small)" : 17,
          fontWeight: tone === "quiet" ? 400 : 500,
          color: tone === "quiet" ? "var(--text-on-sheet-muted)" : "var(--text-on-sheet)",
        }}
      >
        <ChevronIcon size={18} direction="right" style={{ flexShrink: 0, opacity: 0.7 }} />
        {title}
      </summary>

      <div style={{ padding: "2px 2px 28px" }}>{children}</div>
    </details>
  );
}
