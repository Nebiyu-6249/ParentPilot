"use client";

import { useState } from "react";

import { ChevronIcon } from "@/components/icons";

/**
 * A standard code that opens in place.
 *
 * A parent who wants to know what `CCSS.MATH.5.NF.A.1` means should not have
 * to leave the screen they are working on to find out, and should not have to
 * lose their place in the ladder to satisfy a small curiosity.
 */
export default function Citation({ code, plainLanguage }: { code: string; plainLanguage: string | null }) {
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
          color: "var(--action)",
          border: "1px solid var(--border-interactive)",
        }}
      >
        {code}
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
        </span>
      )}
    </span>
  );
}
