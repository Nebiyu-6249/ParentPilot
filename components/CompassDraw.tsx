"use client";

import { CENTRE_HOLE_PATH, LOGO_VIEWBOX, SQUARE_PATH, STAR_LENGTH, STAR_PATH, TAIL_PATH } from "@/lib/logo";

/**
 * The compass star drawing itself.
 *
 * Used twice: once at full speed in the intro reveal, and once slowed and
 * looping as the processing indicator during packet generation. Extracting
 * it means the thing a parent watches while waiting is literally the same
 * animation they saw on arrival, which is the point.
 */

export type CompassMode =
  /** Draws once and stays. Used by the intro reveal. */
  | "draw"
  /** Draws over and over, slowly. Used while a packet generates. */
  | "loop"
  /** No drawing, just the finished mark breathing. Used by the Live Mode rest state. */
  | "breathe"
  /** Static, no motion at all. */
  | "static";

interface CompassDrawProps {
  mode: CompassMode;
  /** Rendered pixel width. The mark is square plus the tail. */
  size?: number;
  /** One full draw, in milliseconds. */
  durationMs?: number;
  /** Delay before the star starts drawing. */
  delayMs?: number;
  /** Draw the square container too, and when. Null omits it entirely. */
  squareDelayMs?: number | null;
  /** Show the chat-bubble tail, and when. Null omits it entirely. */
  tailDelayMs?: number | null;
  color?: string;
  className?: string;
}

export default function CompassDraw({
  mode,
  size = 92,
  durationMs = 500,
  delayMs = 0,
  squareDelayMs = null,
  tailDelayMs = null,
  color = "var(--emerald)",
  className,
}: CompassDrawProps) {
  const animating = mode === "draw" || mode === "loop";

  const starStyle: React.CSSProperties = animating
    ? {
        strokeDasharray: STAR_LENGTH,
        strokeDashoffset: STAR_LENGTH,
        animation: `pp-draw ${durationMs}ms ease-out ${delayMs}ms ${mode === "loop" ? "infinite" : "1"} forwards`,
      }
    : {};

  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={size}
      height={(size * 80) / 92}
      className={`${className ?? ""}${mode === "breathe" ? " pp-breathe" : ""}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {squareDelayMs !== null && (
        <path
          d={SQUARE_PATH}
          stroke="var(--teal)"
          strokeWidth={3}
          style={
            animating
              ? {
                  strokeDasharray: 256,
                  strokeDashoffset: 256,
                  animation: `pp-draw 300ms ease-out ${squareDelayMs}ms 1 forwards`,
                }
              : {}
          }
        />
      )}

      <path
        d={STAR_PATH}
        stroke={color}
        strokeWidth={3}
        strokeLinejoin="miter"
        style={starStyle}
      />

      <path d={CENTRE_HOLE_PATH} stroke={color} strokeWidth={2} />

      {tailDelayMs !== null && (
        <path
          d={TAIL_PATH}
          fill="var(--teal)"
          style={
            animating
              ? { opacity: 0, animation: `pp-fade-in 200ms ease-out ${tailDelayMs}ms 1 forwards` }
              : {}
          }
        />
      )}
    </svg>
  );
}
