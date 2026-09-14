/**
 * A child's handwriting, drawn rather than typeset.
 *
 * The hero has to show real working in a real hand. A handwriting webfont was
 * the obvious route and the wrong one: Caveat and Kalam are instantly
 * recognisable and would read as a template choice, which is the exact failure
 * this redesign exists to fix. The icons are custom for the same reason, and
 * three short lines of arithmetic is a tractable amount of path work.
 *
 * Each glyph is drawn in a 14 by 24 box on a baseline of 20. Per-glyph jitter
 * is derived from the character's position, never from `Math.random`, so the
 * server and the client draw the identical page and hydration is stable.
 */

const ADVANCE = 13;
const LINE_HEIGHT = 27;

/** Glyphs the fixture's working actually needs, plus a few neighbours. */
const GLYPHS: Record<string, string> = {
  "0": "M 7 4.4 Q 11.2 4.6 11.1 12.2 Q 11 20 7 19.9 Q 3 19.8 3.1 12.2 Q 3.2 4.5 7 4.4",
  "1": "M 3.8 7.2 Q 5.4 5.5 6.9 4.1 L 7.3 20.1",
  "2": "M 3.2 7.4 Q 4.4 4.2 8 4.4 Q 11.3 4.7 10.6 8.4 Q 10 11.7 3.4 19.9 L 11.3 19.5",
  "3": "M 3.4 5.6 Q 7.4 3.4 10 5.7 Q 11.8 7.7 7.5 11.4 Q 12.2 11.9 11.3 16.1 Q 10.5 20.6 3.6 19.1",
  "4": "M 9.7 4 L 2.8 14.9 L 12 14.6 M 9.2 10.2 L 9.5 20.2",
  "5": "M 10.6 4.3 L 4.2 4.6 L 3.6 11.4 Q 8.4 9.6 10.8 12.6 Q 12.6 15.6 9.6 18.6 Q 6.6 21 3.2 18.8",
  "6": "M 10.4 4.6 Q 4.4 7.4 3.4 13.4 Q 2.8 19.8 7.2 19.9 Q 11.4 20 11.2 15.8 Q 11 12 7 12.2 Q 4.4 12.4 3.5 14.6",
  "7": "M 2.8 4.6 L 11.6 4.3 Q 8.2 11 6.3 20.2",
  "8": "M 7.2 11.6 Q 3.4 10.4 3.8 7.2 Q 4.2 4.2 7.4 4.3 Q 10.6 4.4 10.8 7.4 Q 11 10.6 7.2 11.6 Q 2.8 12.8 3.1 16.4 Q 3.4 20 7.3 19.9 Q 11.2 19.8 11.3 16.3 Q 11.4 12.7 7.2 11.6",
  "9": "M 11 11.2 Q 9.6 13.4 6.8 13 Q 3.4 12.6 3.6 9 Q 3.8 4.6 7.6 4.4 Q 11.4 4.2 11.2 9.6 Q 11 16.2 4 20",
  "+": "M 3 12.1 L 11 11.8 M 7 8 L 7.2 16",
  "-": "M 3 12.1 L 11 11.8",
  "=": "M 2.6 9.9 L 11.4 9.4 M 2.8 14.5 L 11.6 14",
  "/": "M 10.9 4.4 L 3.3 20",
  s: "M 10.1 10.1 Q 6 8 4.4 10.7 Q 3.2 12.9 7.4 13.8 Q 11.5 14.8 10.2 17.7 Q 8.9 20.3 4 19",
  o: "M 7 9.5 Q 11.4 10 11.2 14.7 Q 11 19.7 7 19.6 Q 3 19.5 3.2 14.6 Q 3.4 9.9 7 9.5",
};

/** Deterministic jitter in roughly [-1, 1], from a character's position. */
function wobble(seed: number): number {
  return ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 * 2 - 1;
}

/**
 * How far the hand strays, per axis.
 *
 * The first pass used a single +/-2.4 degree tilt and the result read as a
 * geometric font. Handwriting varies on several axes at once: slant, size,
 * baseline, and pressure. Varying all of them, and more, is what makes it stop
 * looking typeset.
 */
const HAND = {
  /** Forward slant of the whole hand, degrees. */
  slant: -9,
  /** Per-glyph rotation on top of the slant. */
  tilt: 5.5,
  /** Per-glyph size variation, as a fraction. */
  scale: 0.09,
  jitterX: 1.5,
  jitterY: 2.1,
  /** Pencil pressure: stroke width swing, as a fraction of `weight`. */
  pressure: 0.2,
  /** Slow baseline drift across a line, in px. */
  drift: 1.8,
} as const;

export interface HandwritingProps {
  /** Lines of working, newline separated, exactly as transcribed. */
  text: string;
  /** Pencil stroke width. */
  weight?: number;
  /**
   * Circle one glyph the way a teacher rings the wrong digit. Drawn in the
   * same coordinate space as the handwriting, so it cannot drift out of
   * register the way an absolutely positioned overlay would.
   */
  ring?: { line: number; index: number };
  className?: string;
}

/** Laid-out geometry, so callers can position an annotation over a glyph. */
export interface GlyphBox {
  char: string;
  line: number;
  index: number;
  x: number;
  y: number;
}

export function layoutHandwriting(text: string): { boxes: GlyphBox[]; width: number; height: number } {
  const lines = text.split("\n");
  const boxes: GlyphBox[] = [];
  let widest = 0;

  lines.forEach((line, lineIndex) => {
    let x = 0;
    [...line].forEach((char, charIndex) => {
      if (char !== " ") {
        boxes.push({
          char,
          line: lineIndex,
          index: charIndex,
          x,
          y: lineIndex * LINE_HEIGHT,
        });
      }
      x += char === " " ? ADVANCE * 0.55 : ADVANCE;
    });
    widest = Math.max(widest, x);
  });

  return { boxes, width: widest, height: lines.length * LINE_HEIGHT };
}

export default function Handwriting({ text, weight = 1.9, ring, className }: HandwritingProps) {
  const { boxes, width, height } = layoutHandwriting(text);

  const ringed = ring ? boxes.find((b) => b.line === ring.line && b.index === ring.index) : undefined;
  const pad = ringed ? 14 : 2;

  return (
    <svg
      viewBox={`-${pad} -${pad} ${Math.ceil(width) + pad * 2} ${Math.ceil(height) + pad * 2}`}
      className={className}
      fill="none"
      stroke="var(--pencil)"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`Handwritten working: ${text.split("\n").join(", ")}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {boxes.map((box) => {
        const d = GLYPHS[box.char];
        if (!d) return null;

        const seed = box.line * 17 + box.index * 3 + 1;
        const tilt = HAND.slant + wobble(seed) * HAND.tilt;
        const scale = 1 + wobble(seed + 0.31) * HAND.scale;
        const dx = wobble(seed + 0.62) * HAND.jitterX;
        // Baseline drifts slowly along a line, the way a hand does on unruled
        // paper, with per-glyph jitter on top.
        const dy =
          wobble(seed + 0.93) * HAND.jitterY + Math.sin(box.index * 0.7 + box.line) * HAND.drift;
        const pressure = weight * (1 + wobble(seed + 1.27) * HAND.pressure);

        return (
          <path
            key={`${box.line}-${box.index}`}
            d={d}
            strokeWidth={pressure.toFixed(2)}
            transform={
              `translate(${(box.x + dx).toFixed(2)} ${(box.y + dy).toFixed(2)}) ` +
              `rotate(${tilt.toFixed(2)} 7 12) scale(${scale.toFixed(3)})`
            }
          />
        );
      })}

      {ringed && <PenRing cx={ringed.x + 7} cy={ringed.y + 12} />}
    </svg>
  );
}

/**
 * An open ellipse with the overshoot a real pen leaves where it crosses its
 * own start, plus a caret pointing up at what was circled.
 */
function PenRing({ cx, cy }: { cx: number; cy: number }) {
  const rx = 11.5;
  const ry = 14.5;

  const d = [
    `M ${cx} ${cy - ry}`,
    `C ${cx + rx * 0.92} ${cy - ry}, ${cx + rx} ${cy - ry * 0.42}, ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ry * 0.62}, ${cx + rx * 0.62} ${cy + ry}, ${cx} ${cy + ry}`,
    `C ${cx - rx * 0.62} ${cy + ry}, ${cx - rx} ${cy + ry * 0.62}, ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ry * 0.42}, ${cx - rx * 0.92} ${cy - ry}, ${cx} ${cy - ry}`,
    `C ${cx + rx * 0.52} ${cy - ry * 1.06}, ${cx + rx * 0.88} ${cy - ry * 0.78}, ${cx + rx * 1.02} ${cy - ry * 0.3}`,
  ].join(" ");

  return (
    <g stroke="var(--annotation)" strokeWidth={2.1} fill="none" strokeLinecap="round">
      <path d={d} />
      <path d={`M ${cx - 6} ${cy + ry + 10} L ${cx} ${cy + ry + 3.5} L ${cx + 6} ${cy + ry + 10}`} />
    </g>
  );
}

export { ADVANCE as HANDWRITING_ADVANCE, LINE_HEIGHT as HANDWRITING_LINE_HEIGHT };
