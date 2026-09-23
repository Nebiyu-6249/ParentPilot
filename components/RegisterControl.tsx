"use client";

import { useMessages } from "@/components/LocaleProvider";
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
 *
 * Compact renders twice and shows one. Three segments need about 240px and a
 * 390px bar does not have them once the sidebar toggle and Share are in it, so
 * below the drawer breakpoint the control collapses to a native `<select>`
 * carrying its current value. Native because a phone renders it as the picker
 * the parent already knows, and because `display: none` on the other variant
 * takes it out of the tab order as well as out of sight, which a hand-written
 * popover would not do for free.
 */
export default function RegisterControl({
  value,
  onChange,
  busy = false,
  compact = false,
  surface = "sheet",
}: {
  value: RegisterName;
  onChange: (next: RegisterName) => void;
  busy?: boolean;
  compact?: boolean;
  /**
   * Which token family to wear. `compact` implies the product surface, since
   * the only compact instance is the thread's top bar; `surface` is for the
   * full size control on Settings, which lives on the product surface too and
   * was otherwise the one thing on that screen still coloured like the site.
   */
  surface?: "sheet" | "app";
}) {
  const t = useMessages();
  const onApp = compact || surface === "app";
  const activeBg = onApp ? "var(--accent-fill)" : "var(--action)";
  const activeFg = onApp ? "#ffffff" : "var(--action-label)";
  const idleFg = onApp ? "var(--app-text-dim)" : "var(--muted)";
  const line = onApp ? "var(--app-border-interactive)" : "var(--border-interactive)";

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
            color: onApp ? "var(--app-text-dim)" : "var(--muted)",
            marginBottom: 8,
          }}
        >
          {t.register.heading}
        </span>
      )}

      {compact && (
        <select
          className="pp-register-select"
          aria-label={t.register.heading}
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value as RegisterName)}
        >
          {t.register.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      <div
        role="radiogroup"
        aria-label={t.register.heading}
        className={compact ? "pp-register-segments" : undefined}
        style={{
          borderRadius: onApp ? "var(--r-control)" : undefined,
          overflow: onApp ? "hidden" : undefined,
          /* Compact takes its display from the stylesheet. An inline display
             beats any rule that does not shout, so setting it here left both
             variants rendered at 390px with the segments spilling out of the
             bar and sitting in the tab order twice. */
          display: compact ? undefined : "flex",
        }}
      >
        {t.register.options.map((option, index) => {
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
                borderInlineStartWidth: index === 0 ? 1 : 0,
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
