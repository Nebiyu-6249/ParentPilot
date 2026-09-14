"use client";

import { copy } from "@/lib/copy";
import type { RegisterName } from "@/lib/ai/schemas";

/**
 * Simpler / Standard / More technical.
 *
 * Changes every parent-facing string on the current screen without a page
 * reload. The caller owns the swap: this is a segmented control that reports
 * the choice, and the screen refetches its own copy at the new register.
 */
export default function RegisterControl({
  value,
  onChange,
  busy = false,
}: {
  value: RegisterName;
  onChange: (next: RegisterName) => void;
  busy?: boolean;
}) {
  return (
    <div>
      <span
        style={{
          display: "block",
          fontSize: 13,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 8,
        }}
      >
        {copy.register.heading}
      </span>
      <div role="radiogroup" aria-label={copy.register.heading} style={{ display: "flex" }}>
        {copy.register.options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => onChange(option.value)}
              style={{
                flex: 1,
                padding: "11px 10px",
                fontSize: 15,
                fontWeight: active ? 500 : 400,
                background: active ? "var(--emerald)" : "transparent",
                color: active ? "var(--paper)" : "var(--muted)",
                border: "1px solid var(--rule)",
                borderLeftWidth: index === 0 ? 1 : 0,
                transition: "background 200ms ease-out, color 200ms ease-out",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
