import { CENTRE_HOLE_PATH, LOGO_VIEWBOX, SQUARE_PATH, STAR_PATH, TAIL_PATH } from "@/lib/logo";
import { copy } from "@/lib/copy";

/**
 * Which surface the mark is sitting on.
 *
 * "paper" and "frame" are the site's two grounds and use the fixed brand
 * colours. "app" is the chat shell, whose ground changes with the theme:
 * brand teal on the dark rail is about 1.6:1, so there the mark takes the
 * surface's own text colour and the emerald star carries the brand.
 */
export type LogoSurface = "paper" | "frame" | "app";

function containerColour(on: LogoSurface): string {
  if (on === "frame") return "var(--text-on-frame)";
  if (on === "app") return "var(--app-text)";
  return "var(--brand-teal)";
}

function surface(on: LogoSurface | undefined, onFrame: boolean): LogoSurface {
  return on ?? (onFrame ? "frame" : "paper");
}

/** The resting mark: square container, filled star, hollow centre, tail. */
export function LogoMark({
  size = 28,
  onFrame = false,
  on,
}: {
  size?: number;
  onFrame?: boolean;
  on?: LogoSurface;
}) {
  const container = containerColour(surface(on, onFrame));
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
      <path d={`${STAR_PATH} ${CENTRE_HOLE_PATH}`} fill="var(--brand-emerald)" fillRule="evenodd" />
      <path d={TAIL_PATH} fill={container} />
    </svg>
  );
}

/** Mark plus wordmark. Fraunces SemiBold. One of only two places the display
 *  face appears; the other is the hero headline. */
export default function Logo({
  size = 28,
  onFrame = false,
  on,
}: {
  size?: number;
  onFrame?: boolean;
  on?: LogoSurface;
}) {
  const where = surface(on, onFrame);
  return (
    /* The lockup is a fixed pair and keeps its order in every direction: the
       wordmark is a Latin proper noun in all four locales, and a mark that
       jumped to the other side of it in Arabic would read as a different
       logo rather than as a mirrored one. globals.css pins the direction. */
    <span className="pp-logo" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} on={where} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: size * 0.72,
          color: containerColour(where),
          letterSpacing: "-0.015em",
        }}
      >
        {copy.brand.name}
      </span>
    </span>
  );
}
