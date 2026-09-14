import Handwriting from "@/components/Handwriting";
import { AlertIcon } from "@/components/icons";

/**
 * The product in one image.
 *
 * A worksheet carrying a child's wrong working, with the coaching card beside
 * it. This is the whole pitch, legible in two seconds without reading a word
 * of prose, and every string in it comes from `seed/demo-packet.json` rather
 * than being written for the marketing page. What a parent sees here is what
 * the product actually produces.
 */

export interface HeroArtifactProps {
  printedText: string;
  childWorkText: string;
  misconceptionName: string;
  repairQuestion: string;
  standardCode: string | null;
  /** Which glyph the pen circles: the wrong denominator. */
  ring?: { line: number; index: number };
}

export default function HeroArtifact({
  printedText,
  childWorkText,
  misconceptionName,
  repairQuestion,
  standardCode,
  ring,
}: HeroArtifactProps) {
  return (
    <div className="pp-artifact">
      <div className="pp-sheet pp-worksheet">
        <span
          style={{
            display: "block",
            fontSize: "var(--type-micro)",
            color: "var(--text-on-sheet-muted)",
            marginBottom: 10,
          }}
        >
          Question 3
        </span>

        <p
          style={{
            fontSize: 24,
            color: "var(--text-on-sheet)",
            letterSpacing: "0.01em",
            marginBottom: 18,
          }}
        >
          {printedText}
        </p>

        <Handwriting text={childWorkText} className="pp-handwriting" ring={ring} />
      </div>

      <div className="pp-sheet pp-coach-card">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--type-micro)",
            color: "var(--annotation)",
            marginBottom: 10,
          }}
        >
          <AlertIcon size={16} />
          What went wrong
        </span>

        <h2 style={{ fontSize: "var(--type-h3)", marginBottom: 10, color: "var(--text-on-sheet)" }}>
          {misconceptionName}
        </h2>

        <p style={{ fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)", marginBottom: 14 }}>
          Ask this
        </p>

        <p style={{ fontSize: 17, color: "var(--text-on-sheet)" }}>{repairQuestion}</p>

        {standardCode && (
          <p
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--rule-on-sheet)",
              fontSize: "var(--type-micro)",
              color: "var(--text-on-sheet-muted)",
            }}
          >
            {standardCode}
          </p>
        )}
      </div>
    </div>
  );
}
