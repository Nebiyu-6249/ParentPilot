import type { MethodMatch, MoveLabelName, RegisterName, Script } from "@/lib/ai/schemas";

/** Shapes shared between server and client. Kept free of Prisma imports so
 *  client components can use them without pulling the engine into the bundle. */

export interface ProblemView {
  id: string;
  index: number;
  printedText: string;
  childWorkText: string | null;
  childAnswer: string | null;
  ocrConfidence: number | null;
  standardCode: string | null;
  /** How close the search that chose `standardCode` was, 0 to 1, or null for
   *  a problem matched before scores were recorded. */
  standardSimilarity: number | null;
  expectedMethod: string | null;
  verified: boolean;
  computedAnswer: string | null;
  misconceptionId: string | null;
  status: "OPEN" | "SOLVED" | "PARKED";
}

/**
 * Below this, the standard chip says "closest match" instead of asserting one.
 *
 * Chosen from what the corpus actually returns rather than from a round
 * number: a problem that is plainly about a seeded standard comes back in the
 * high 0.7s and above, and the tail below 0.6 is where the search is matching
 * on shape rather than on subject. It is a starting line, and it is stored
 * per problem so it can be moved without re-embedding anything.
 *
 * The distinction matters because the chip is a claim about a child's
 * classroom. "This is what your class is doing" and "this is the nearest
 * thing we found" are different sentences, and a product that only knows how
 * to say the first one says it when it is not true.
 */
export const STANDARD_CERTAIN_AT = 0.6;

/**
 * The same line, for a search that had no curriculum to scope by.
 *
 * Higher, because an unscoped 0.6 is not a weaker version of a scoped 0.6, it
 * is a different claim. Two curricula now teach the same mathematics in
 * different words, so a search with no scope is choosing a syllabus as well as
 * a standard, and the similarity score says nothing at all about the first
 * choice. The eval measures how much that matters: with the scope removed,
 * around half the Common Core probes and a quarter of the England ones land on
 * the other country's standard.
 *
 * 0.75 is the bottom of the band the comment above describes as plainly on
 * topic. Unscoped, the chip asserts only from inside that band and hedges
 * everywhere else.
 */
export const STANDARD_UNSCOPED_CERTAIN_AT = 0.75;

/**
 * What the search that produced a citation was allowed to look at.
 *
 * Carried on the bundle rather than recomputed, because the component that
 * renders the chip is a long way from the query that answered it and the only
 * honest place to decide is next to the search.
 */
export interface StandardScope {
  /**
   * The curriculum the search was restricted to, or null when nothing
   * restricted it.
   *
   * Null means the anonymous path: no profile, so no child, so no curriculum.
   * `Child.curriculum` is not nullable, so a parent who has told us about a
   * child has always told us this.
   */
  requested: string | null;
  /** True when the requested curriculum held nothing and the whole corpus was
   *  searched instead. */
  fellBack: boolean;
  /** True when the shortlist spanned more than one curriculum, so the syllabus
   *  was as open a question as the standard. */
  mixed: boolean;
}

/**
 * True when the chip should hedge rather than assert.
 *
 * The scope is a required argument rather than an optional one. A caller that
 * has not thought about where its answer came from is precisely the caller
 * that should not be asserting a child's curriculum on screen.
 */
export function standardIsUncertain(similarity: number | null, scope: StandardScope): boolean {
  // Null is a problem matched before scores were recorded. Not known is not
  // the same as low, and a backfilled hedge would be a guess on screen.
  if (similarity === null) return false;

  const leftTheScope = scope.requested === null || scope.fellBack;
  if (!leftTheScope) return similarity < STANDARD_CERTAIN_AT;

  /* Evidence rather than a threshold. A shortlist holding two curricula says
     the syllabus this came from was close to a tie, whatever the similarity,
     and there is no honest way to name one of them on a chip. */
  if (scope.mixed) return true;

  return similarity < STANDARD_UNSCOPED_CERTAIN_AT;
}

/**
 * A retrieval candidate: a standard, and how close it was.
 *
 * Separate from `StandardView` because most of the product holds a standard it
 * already knows is the right one. Similarity is a fact about a search, not
 * about a standard, and putting it on the shared type would mean every
 * `standardByCode` result carrying a number that means nothing.
 */
export interface StandardCandidate extends StandardView {
  /**
   * Cosine similarity to the problem text, from 0 to 1.
   *
   * pgvector's `<=>` returns cosine *distance*, so this is `1 - distance`,
   * clamped. Worth knowing when reading a low number: an embedding model puts
   * almost everything in a fairly narrow band, so 0.4 is not "40% right", it
   * is "further away than anything we would normally act on".
   */
  similarity: number;
}

export interface StandardView {
  code: string;
  /** CCSS, ENC or CBSE. Shown to the parent when a match came from a
   *  curriculum other than their child's. */
  curriculum: string;
  grade: number;
  plainLanguage: string;
  expectedMethods: string[];
  parentMethod: string;
}

export interface MisconceptionView {
  id: string;
  topic: string;
  /** What the wrong working looks like. Fed to the packet prompt as context. */
  signature: string;
  plainName: string;
  repairQuestion: string;
  visualSvg: string | null;
}

export interface PacketView {
  register: RegisterName;
  language: string;
  primer: string;
  methodMatch: MethodMatch;
  hintLadder: string[];
  scripts: Script[];
  lockedAnswer: string;
  isomorphs: string[];
  misconceptionNote: string | null;
}

/**
 * Where a packet actually came from.
 *
 * A degraded response that looks identical to a real one is worse than an
 * error, because the parent acts on it believing we read their worksheet. The
 * provenance travels with the payload so the screen can say so plainly.
 */
export type PacketSource =
  /** Generated by a live model call for this problem. */
  | "live"
  /** A previous live generation for this same problem, reused. */
  | "cache"
  /** The bundled demo packet. Not a reading of anything the parent uploaded. */
  | "fixture"
  /** A saved generic packet for this standard, after the model failed twice. */
  | "generic";

/** Everything `/problem/[id]` needs, in one object. */
export interface PacketBundle {
  problem: ProblemView;
  standard: StandardView | null;
  misconception: MisconceptionView | null;
  packet: PacketView;
  /** What the search that found `standard` was allowed to look at. Decides
   *  whether the chip asserts the standard or hedges it. */
  standardScope: StandardScope;
  /** Set when the packet came from the demo fixture or a generic fallback. */
  notice: string | null;
  /** Where this packet came from. See PacketSource. */
  source: PacketSource;
  /** True when the verifier could not check the arithmetic at all. */
  verification: "checked" | "unverified" | "not-applicable";
}

export interface MoveView {
  tOffset: number;
  label: MoveLabelName;
  confidence: number;
}

export interface CardView {
  id: string;
  tOffset: number;
  triggerLabel: MoveLabelName;
  text: string;
}
