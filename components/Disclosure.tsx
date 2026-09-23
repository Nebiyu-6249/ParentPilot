"use client";

import type { ReactNode } from "react";

import { ChevronIcon, type IconProps } from "@/components/icons";

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
  icon: CategoryIcon,
  children,
  tone = "default",
}: {
  title: string;
  /** Category icon. A parent scanning for "the answer" finds the shape first. */
  icon?: (props: IconProps) => React.JSX.Element;
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
        {CategoryIcon && (
          <CategoryIcon
            size={20}
            style={{ flexShrink: 0, color: tone === "quiet" ? "inherit" : "var(--action)" }}
          />
        )}
        <span style={{ flex: 1 }}>{title}</span>
        <ChevronIcon size={18} direction="end" style={{ flexShrink: 0, opacity: 0.55 }} />
      </summary>

      <div style={{ padding: "2px 2px 28px" }}>{children}</div>
    </details>
  );
}
