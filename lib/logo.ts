/**
 * Geometry for the ParentPilot mark.
 *
 * A four-pointed compass star with a hollow centre dot, inside a square
 * container, with a chat-bubble tail off the right edge. Redrawn here as
 * paths rather than imported as an asset so that the star can be stroked and
 * animated with `stroke-dasharray`, which is what both the intro reveal and
 * the processing indicator depend on.
 *
 * Square corners throughout. The supplied source art has rounded corners;
 * this design system does not have rounded corners anywhere, so the mark is
 * redrawn square.
 */

export const LOGO_VIEWBOX = "0 0 92 80";

/** Square container, drawn as an open path so it can be animated stroke-first. */
export const SQUARE_PATH = "M 8 8 H 72 V 72 H 8 Z";
export const SQUARE_LENGTH = 256;

/**
 * Four-pointed star, centre (40, 40), outer radius 22, inner radius 7.
 * Inner vertices sit at 45 degrees, at 40 +/- 7 * cos(45) = 40 +/- 4.95.
 */
export const STAR_PATH =
  "M 40 18 L 44.95 35.05 L 62 40 L 44.95 44.95 L 40 62 L 35.05 44.95 L 18 40 L 35.05 35.05 Z";

/** Eight equal edges of about 17.75 units. Rounded up so the dash fully clears. */
export const STAR_LENGTH = 146;

/** The hollow centre, as a subpath so `fill-rule="evenodd"` punches it out. */
export const CENTRE_HOLE_PATH =
  "M 36.8 40 a 3.2 3.2 0 1 0 6.4 0 a 3.2 3.2 0 1 0 -6.4 0 Z";

/** Star plus hole, for the filled version of the mark. */
export const STAR_FILLED_PATH = `${STAR_PATH} ${CENTRE_HOLE_PATH}`;

/** Chat-bubble tail, projecting from the right edge of the square. */
export const TAIL_PATH = "M 72 46 L 84 53 L 72 60 Z";
