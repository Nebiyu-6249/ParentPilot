/**
 * Sanitiser for model-generated SVG.
 *
 * The Method Match diagram is written by a model and rendered as markup, so
 * it is untrusted input on a page a parent is logged into. This strips
 * anything that can execute, fetch, or navigate, and enforces the parts of
 * the design system a prompt can only request: square corners, no gradients,
 * no filters.
 *
 * Allowlist based. Anything not explicitly permitted is removed, so a new
 * SVG feature cannot quietly become an attack surface.
 */

const ALLOWED_TAGS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "text", "tspan", "defs", "marker", "title", "desc",
]);

const ALLOWED_ATTRS = new Set([
  "viewbox", "xmlns", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy",
  "r", "rx", "ry", "width", "height", "points", "fill", "stroke",
  "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
  "fill-rule", "clip-rule", "font-size", "font-family", "font-weight",
  "text-anchor", "dominant-baseline", "transform", "opacity",
  "fill-opacity", "stroke-opacity", "id", "class", "dx", "dy",
  "marker-end", "marker-start", "orient", "refx", "refy",
  "markerwidth", "markerheight",
]);

/** Colours the design system permits inside a diagram. */
const ALLOWED_COLOURS = new Set([
  "none", "currentcolor", "transparent",
  "#14201e", "#00a878", "#0b4f4a", "#d9d2c4", "#6e665a", "#a8422f", "#f5f1e8",
]);

const COLOUR_ATTRS = new Set(["fill", "stroke"]);

const MAX_ELEMENTS = 120;
const MAX_LENGTH = 24_000;

function isSafeColour(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (ALLOWED_COLOURS.has(v)) return true;
  // Any url(), gradient reference or expression is rejected outright.
  return false;
}

/**
 * Returns sanitised SVG markup, or null if the input cannot be made safe.
 *
 * Null is a perfectly good outcome: the Method Match column renders its steps
 * without a diagram rather than rendering something unsafe.
 */
export function sanitizeSvg(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw.startsWith("<svg") || raw.length > MAX_LENGTH) return null;

  // Reject outright anything that can execute or fetch, before parsing.
  if (/<\s*(script|foreignObject|style|image|use|animate|set|iframe)\b/i.test(raw)) return null;
  if (/\son\w+\s*=/i.test(raw)) return null;
  if (/(javascript:|data:(?!image\/svg\+xml;base64,)|xlink:href|href\s*=)/i.test(raw)) return null;
  if (/(Gradient|<filter|url\s*\()/i.test(raw)) return null;

  let elementCount = 0;
  let ok = true;

  const cleaned = raw.replace(/<\/?([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g, (match, tagName: string, attrText: string) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      ok = false;
      return "";
    }

    if (match.startsWith("</")) return `</${tag}>`;

    elementCount += 1;
    if (elementCount > MAX_ELEMENTS) {
      ok = false;
      return "";
    }

    const attrs: string[] = [];
    for (const attrMatch of attrText.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"|([a-zA-Z][\w:-]*)\s*=\s*'([^']*)'/g)) {
      const name = (attrMatch[1] ?? attrMatch[3] ?? "").toLowerCase();
      const value = attrMatch[2] ?? attrMatch[4] ?? "";

      if (!ALLOWED_ATTRS.has(name)) continue;
      if (COLOUR_ATTRS.has(name) && !isSafeColour(value)) continue;
      // Square corners everywhere, including inside generated diagrams.
      if ((name === "rx" || name === "ry") && value.trim() !== "0") continue;
      if (/[<>]/.test(value)) continue;

      attrs.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
    }

    const selfClosing = match.endsWith("/>");
    return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}${selfClosing ? "/" : ""}>`;
  });

  if (!ok) return null;
  if (!cleaned.includes("<svg")) return null;

  return cleaned;
}
