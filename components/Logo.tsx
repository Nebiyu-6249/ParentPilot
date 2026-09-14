import { CENTRE_HOLE_PATH, LOGO_VIEWBOX, SQUARE_PATH, STAR_PATH, TAIL_PATH } from "@/lib/logo";
import { copy } from "@/lib/copy";

/** The resting mark: square container, filled star, hollow centre, tail. */
export function LogoMark({ size = 28, onFrame = false }: { size?: number; onFrame?: boolean }) {
  const container = onFrame ? "var(--text-on-frame)" : "var(--teal)";
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={size}
      height={(size * 80) / 92}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={SQUARE_PATH} fill="none" stroke={container} strokeWidth={5} />
      <path d={`${STAR_PATH} ${CENTRE_HOLE_PATH}`} fill="var(--emerald)" fillRule="evenodd" />
      <path d={TAIL_PATH} fill={container} />
    </svg>
  );
}

/** Mark plus wordmark. Fraunces SemiBold. One of only two places the display
 *  face appears; the other is the hero headline. */
export default function Logo({ size = 28, onFrame = false }: { size?: number; onFrame?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} onFrame={onFrame} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: size * 0.72,
          color: onFrame ? "var(--text-on-frame)" : "var(--teal)",
          letterSpacing: "-0.015em",
        }}
      >
        {copy.brand.name}
      </span>
    </span>
  );
}
