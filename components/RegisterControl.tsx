"use client";

import { copy } from "@/lib/copy";
import type { RegisterName } from "@/lib/ai/schemas";

/**
 * Simpler / Standard / More technical.
 *
 * Changes every parent-facing string on the current screen without a page
 * reload. The caller owns the swap: this is a segmented control that reports
 * the choice, and the screen refetches its own copy at the new register.
 *
 * `compact` is for the /app top bar, where this is a setting rather than a
 * step: no heading, app tokens, and small enough that it does not outweigh
 * the thread it sits above.
 */
export default function RegisterControl({
  value,
  onChange,
  busy = false,
  compact = false,
}: {
  value: RegisterName;
  onChange: (next: RegisterName) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const activeBg = compact ? "var(--accent-ink)" : "var(--action)";
  const activeFg = compact ? "var(--app-card)" : "var(--action-label)";
  const idleFg = compact ? "var(--app-text-dim)" : "var(--muted)";
  const line = compact ? "var(--app-line)" : "var(--border-interactive)";

  return (
    <div>
      {/* The heading is a visible label on the setup screens, where choosing a
          register is the task. In the top bar it would be an eyebrow over a
          control that already says what it does, so it stays for screen
          readers only. */}
      {compact ? null : (
        <span
          style={{
            display: "block",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          {copy.register.heading}
        </span>
      )}

      <div
        role="radiogroup"
        aria-label={copy.register.heading}
        style={{
          display: "flex",
          borderRadius: compact ? "var(--r-control)" : undefined,
          overflow: compact ? "hidden" : undefined,
        }}
      >
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
                whiteSpace: compact ? "nowrap" : undefined,
                padding: compact ? "6px 11px" : "11px 10px",
                fontSize: compact ? 13 : 15,
                fontWeight: active ? 500 : 400,
                borderRadius: 0,
                background: active ? activeBg : "transparent",
                color: active ? activeFg : idleFg,
                border: `1px solid ${line}`,
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
