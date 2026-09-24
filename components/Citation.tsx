"use client";

import { useState } from "react";

import { ChevronIcon } from "@/components/icons";
import { useMessages } from "@/components/LocaleProvider";

/**
 * A standard code that opens in place.
 *
 * A parent who wants to know what `CCSS.MATH.5.NF.A.1` means should not have
 * to leave the screen they are working on to find out, and should not have to
 * lose their place in the ladder to satisfy a small curiosity.
 */
export default function Citation({
  code,
  plainLanguage,
  uncertain = false,
}: {
  code: string;
  plainLanguage: string | null;
  /**
   * The search that found this was weak.
   *
   * The chip then hedges instead of asserting, because it is a claim about a
   * child's classroom. "This is what your class is doing" and "this is the
   * nearest thing we found" are different sentences, and saying the first
   * when only the second is true is the kind of confident wrongness this
   * product exists to avoid.
   */
  uncertain?: boolean;
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  if (!plainLanguage) {
    return (
      <span style={{ fontSize: "var(--type-micro)", color: "var(--text-on-sheet-muted)" }}>{code}</span>
    );
  }

  return (
    <span style={{ display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 7px",
          fontSize: "var(--type-micro)",
          background: "transparent",
          color: uncertain ? "var(--text-on-sheet-muted)" : "var(--action)",
          /* Dashed rather than a different colour alone, so the hedge survives
             a screenshot in greyscale and a parent who does not distinguish
             the two greens. */
          border: uncertain
            ? "1px dashed var(--border-interactive)"
            : "1px solid var(--border-interactive)",
        }}
      >
        {uncertain ? `${t.packet.standardClosest} ${code}` : code}
        <ChevronIcon size={13} direction={open ? "up" : "down"} />
      </button>

      {open && (
        <span
          className="pp-settle"
          style={{
            display: "block",
            marginTop: 10,
            paddingInlineStart: 12,
            borderInlineStart: "2px solid var(--annotation)",
            fontSize: 16,
            color: "var(--text-on-sheet)",
            maxWidth: "62ch",
          }}
        >
          {plainLanguage}
          {uncertain && (
            <span
              style={{
                display: "block",
                marginTop: 8,
                fontSize: "var(--type-small)",
                color: "var(--text-on-sheet-muted)",
              }}
            >
              {t.packet.standardUncertainHelp}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
