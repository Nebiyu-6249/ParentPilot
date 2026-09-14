"use client";

import { useState } from "react";

import { copy } from "@/lib/copy";
import { buttonStyle } from "@/components/ui";

/**
 * Five rungs, revealed exactly one per tap.
 *
 * The reveal is one at a time rather than a collapsed list because a parent
 * who can see rung five can read rung five, and rung five is a hair from the
 * answer. The friction is the feature.
 */
export default function HintLadder({ rungs }: { rungs: string[] }) {
  const [revealed, setRevealed] = useState(1);
  const done = revealed >= rungs.length;

  return (
    <div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rungs.slice(0, revealed).map((rung, index) => (
          <li
            key={rung}
            className="pp-settle"
            style={{
              display: "flex",
              gap: 14,
              padding: "16px 0",
              borderBottom: index === revealed - 1 ? "none" : "1px solid var(--rule)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                color: "var(--emerald)",
                minWidth: 24,
                lineHeight: 1.4,
              }}
            >
              {index + 1}
            </span>
            <p style={{ fontSize: 17 }}>{rung}</p>
          </li>
        ))}
      </ol>

      {done ? (
        <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 18 }}>{copy.packet.hintDone}</p>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed((n) => Math.min(n + 1, rungs.length))}
          style={{ ...buttonStyle("secondary", true), marginTop: 18 }}
        >
          {copy.packet.hintReveal}
        </button>
      )}
    </div>
  );
}
