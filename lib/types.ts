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
  expectedMethod: string | null;
  verified: boolean;
  computedAnswer: string | null;
  misconceptionId: string | null;
  status: "OPEN" | "SOLVED" | "PARKED";
}

export interface StandardView {
  code: string;
  grade: number;
  plainLanguage: string;
  expectedMethods: string[];
  parentMethod: string;
}

export interface MisconceptionView {
  id: string;
  topic: string;
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

/** Everything `/problem/[id]` needs, in one object. */
export interface PacketBundle {
  problem: ProblemView;
  standard: StandardView | null;
  misconception: MisconceptionView | null;
  packet: PacketView;
  /** Set when the packet came from the demo fixture or a generic fallback. */
  notice: string | null;
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
