"use client";

import { useState, type ReactNode } from "react";

import Citation from "@/components/Citation";
import LockedAnswer from "@/components/LockedAnswer";
import MethodMatch from "@/components/MethodMatch";
import {
  AlertIcon,
  BookIcon,
  CheckIcon,
  ChevronIcon,
  ColumnsIcon,
  LockIcon,
  MicrophoneIcon,
  TypeIcon,
  type IconProps,
} from "@/components/icons";
import { copy } from "@/lib/copy";
import { Markdown } from "@/lib/markdown";
import { sanitizeSvg } from "@/lib/svg";
import type { Card } from "@/lib/thread";

/**
 * The cards inside a thread.
 *
 * The shell around these is deliberately conventional; this is where the
 * product is unlike anything else, so this is where the design budget went.
 *
 * Everything is collapsed by default except `ask`, which is always open. The
 * thread has to read as a conversation, not as the wall of panels it replaces.
 */

function Shell({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: (props: IconProps) => React.JSX.Element;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <article className="pp-card">
      <button type="button" className="pp-card-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon size={18} style={{ color: "var(--accent-ink)", flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{title}</span>
        <ChevronIcon size={16} direction={open ? "up" : "down"} style={{ opacity: 0.5 }} />
      </button>
      {open && <div className="pp-card-body">{children}</div>}
    </article>
  );
}

export default function ThreadCard({
  card,
  onAdvance,
  onSolved,
}: {
  card: Card;
  onAdvance: (problemId: string) => void;
  onSolved: (problemId: string) => void;
}) {
  switch (card.kind) {
    /* Never collapsed and never quiet. This is the card that stops a parent
       acting on a saved example as though we had read their page. */
    case "notice":
      return (
        <article
          className="pp-card"
          style={{
            borderColor: "var(--app-alert-line)",
            background: "var(--app-alert-bg)",
            display: "flex",
            gap: 11,
            padding: "13px 15px",
            alignItems: "flex-start",
          }}
        >
          <AlertIcon size={18} style={{ color: "var(--app-alert-ink)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--app-alert-ink)", maxWidth: "62ch" }}>
            {card.body}
          </p>
        </article>
      );

    /* A definition. The one line answer is always visible; the expansion and
       the child level version are each one tap, because a parent asking what a
       denominator is may want to understand it, or may want a sentence to say
       out loud, and those are different things. */
    case "explainer":
      return <Explainer card={card} />;

    /* A method worked through on numbers that are not the child's. The problem
       is stated at the top and styled as the heading, so a parent can see at a
       glance that this is not their child's question. That visibility is what
       makes showing the whole method safe. */
    case "worked_example":
      return (
        <article className="pp-card">
          <div className="pp-card-body" style={{ paddingTop: 15 }}>
            <p className="pp-example-label">{copy.chat.exampleLabel}</p>
            <p className="pp-example-problem">{card.problem}</p>
            <ol className="pp-example-steps">
              {card.steps.map((step, i) => (
                <li key={`${step.move}-${i}`}>
                  <span className="pp-example-move">{step.move}</span>
                  {step.working && <span className="pp-example-working">{step.working}</span>}
                </li>
              ))}
            </ol>
            {card.point && <p className="pp-example-point">{card.point}</p>}
          </div>
        </article>
      );

    case "strategy":
      return (
        <article className="pp-card">
          <div className="pp-card-body" style={{ paddingTop: 15 }}>
            <ol className="pp-strategy">
              {card.moves.map((move, i) => (
                <li key={`${move.title}-${i}`}>
                  <p className="pp-strategy-title">{move.title}</p>
                  <p className="pp-strategy-body">{move.body}</p>
                </li>
              ))}
            </ol>
            {card.avoid && (
              <p className="pp-strategy-avoid">
                <span>{copy.chat.avoidLabel}</span> {card.avoid}
              </p>
            )}
          </div>
        </article>
      );

    case "text":
      return (
        <div
          className="pp-turn-text"
          data-intent={card.intent}
          style={{ fontSize: 15, lineHeight: 1.6, maxWidth: "68ch" }}
        >
          <Markdown source={card.body} />
        </div>
      );

    case "worksheet":
      return (
        <Shell title="What I read on the page" icon={TypeIcon} defaultOpen>
          {card.imageDataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={card.imageDataUrl}
              alt="The worksheet you photographed"
              style={{
                display: "block",
                width: "100%",
                maxWidth: 320,
                borderRadius: "var(--r-control)",
                border: "1px solid var(--app-line)",
                marginBottom: 14,
              }}
            />
          )}

          <p style={{ fontSize: 19, marginBottom: 10 }}>{card.printedText}</p>

          {card.childWorkText && (
            <pre
              style={{
                margin: 0,
                fontFamily: "inherit",
                fontSize: 14,
                whiteSpace: "pre-wrap",
                color: "var(--app-text-dim)",
                borderLeft: "2px solid var(--app-line)",
                paddingLeft: 12,
              }}
            >
              {card.childWorkText}
            </pre>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {card.verification === "checked" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 9px",
                  borderRadius: 999,
                  fontSize: 12,
                  color: "var(--accent-ink)",
                  border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
                }}
              >
                <CheckIcon size={13} />
                {copy.packet.verifiedBadge}
              </span>
            )}
            {card.standardCode && <Citation code={card.standardCode} plainLanguage={card.standardPlain} />}
          </div>
        </Shell>
      );

    case "ask":
      return (
        <article className="pp-card pp-card-ask">
          <div className="pp-card-body" style={{ paddingTop: 18 }}>
            {/* Sentence case. This is an instruction to the parent, not a
                label on a panel, and tracked-out capitals would make it read
                as chrome rather than as the thing to do. */}
            <span
              style={{
                display: "block",
                fontSize: 13,
                color: "var(--accent-ink)",
                marginBottom: 8,
              }}
            >
              {copy.packet.askLabel}
            </span>

            <p className="pp-ask-question">{card.question}</p>

            <p style={{ marginTop: 10, fontSize: 13, color: "var(--app-text-dim)" }}>
              {copy.packet.rungCounter(card.rung + 1, card.total)}
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={card.rung >= card.total - 1}
                onClick={() => onAdvance(card.problemId)}
                style={{
                  padding: "11px 18px",
                  borderRadius: "var(--r-control)",
                  border: "1px solid var(--accent-fill)",
                  background: "var(--accent-fill)",
                  color: "#ffffff",
                  fontSize: 14.5,
                  fontWeight: 500,
                }}
              >
                {copy.packet.stillStuck}
              </button>
              <button
                type="button"
                onClick={() => onSolved(card.problemId)}
                style={{
                  padding: "11px 18px",
                  borderRadius: "var(--r-control)",
                  border: "1px solid var(--app-border-interactive)",
                  background: "transparent",
                  color: "var(--app-text)",
                  fontSize: 14.5,
                }}
              >
                {copy.packet.answeredIt}
              </button>
            </div>

            {card.rung >= card.total - 1 && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--app-text-dim)" }}>
                {copy.packet.ladderExhausted}
              </p>
            )}
          </div>
        </article>
      );

    case "misconception": {
      const svg = sanitizeSvg(card.visualSvg);
      return (
        <Shell title={copy.packet.discloseWhy} icon={AlertIcon}>
          <h3 style={{ fontSize: 15.5, marginBottom: 8 }}>{card.plainName}</h3>
          {card.note && <p style={{ fontSize: 15, lineHeight: 1.6 }}>{card.note}</p>}
          {svg && (
            <div
              className="pp-diagram"
              style={{ marginTop: 16, color: "var(--app-text)" }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
          <p style={{ marginTop: 16, fontSize: 15 }}>
            <span style={{ color: "var(--accent-ink)" }}>{copy.packet.misconceptionRepair}: </span>
            {card.repairQuestion}
          </p>
        </Shell>
      );
    }

    case "method_match":
      return (
        <Shell title={copy.packet.discloseMethods} icon={ColumnsIcon}>
          <MethodMatch data={card.data} />
        </Shell>
      );

    case "teaching":
      return (
        <Shell title={copy.packet.discloseTeaching} icon={BookIcon}>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>{card.opening}</p>
          {card.rest && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13.5, color: "var(--app-text-dim)" }}>
                {copy.packet.primerMore}
              </summary>
              <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 10 }}>{card.rest}</p>
            </details>
          )}
          {card.scripts.length > 0 && (
            <div style={{ marginTop: 18, borderTop: "1px solid var(--app-line)", paddingTop: 14 }}>
              {card.scripts.slice(0, 2).map((script) => (
                <div key={script.avoid} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 14, color: "var(--app-text-dim)", textDecoration: "line-through" }}>
                    {script.avoid}
                  </p>
                  <p style={{ fontSize: 15, marginTop: 4 }}>{script.use}</p>
                </div>
              ))}
            </div>
          )}
        </Shell>
      );

    case "answer":
      return (
        <Shell title={copy.packet.discloseAnswer} icon={LockIcon}>
          <LockedAnswer answer={card.answer} verification={card.verification} />
        </Shell>
      );

    /* Raised while Live Mode is listening. Never collapsed: it is an
       interruption, and an interruption behind a chevron is not one. It keeps
       the minute it fired at, because a parent scrolling back afterwards is
       asking "when did that happen", and because the only thing the product
       kept about that moment is a label and a timestamp. */
    case "live_coach":
      return (
        <article className="pp-card pp-card-coach" role="status">
          <div className="pp-card-body" style={{ paddingTop: 15 }}>
            <p style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <MicrophoneIcon size={15} style={{ color: "var(--accent-ink)" }} />
              <span style={{ fontSize: 12.5, color: "var(--app-text-dim)" }}>
                {formatOffset(card.tOffset)}
              </span>
            </p>
            <p style={{ fontSize: 15.5, lineHeight: 1.55 }}>{card.body}</p>
          </div>
        </article>
      );

    case "live_summary":
      return (
        <Shell title={copy.live.summaryHeading} icon={CheckIcon} defaultOpen>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "var(--accent-ink)", lineHeight: 1 }}>
            {card.autonomyScore.toFixed(2)}
          </p>
          <p style={{ marginTop: 10, fontSize: 15 }}>{card.reading}</p>
          {/* Counts and a duration, which is the entirety of what was kept.
              Naming it is the point: a parent should be able to see that the
              summary was written from this and not from a recording. */}
          <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--app-text-dim)" }}>
            {card.minutes} {card.minutes === 1 ? "minute" : "minutes"}
            {countsLine(card.moveCounts)}
          </p>
          <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--app-text-dim)" }}>
            {copy.live.summaryProvenance}
          </p>
        </Shell>
      );

    case "park_it":
      return (
        <article className="pp-card" style={{ borderColor: "var(--alert-fg)", borderLeftWidth: 3 }}>
          <div className="pp-card-body" style={{ paddingTop: 16 }}>
            <h3 style={{ fontSize: 16, color: "var(--alert-fg)", marginBottom: 8 }}>{copy.live.parkHeading}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>{copy.live.parkBody}</p>
            {card.teacherNote && (
              <p style={{ marginTop: 14, fontSize: 15, whiteSpace: "pre-wrap" }}>{card.teacherNote}</p>
            )}
          </div>
        </article>
      );

    default:
      return null;
  }
}

/** mm:ss since the session started, for a coaching card. */
function formatOffset(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * The move counts, as a sentence.
 *
 * Only the labels that mean something to a parent, and only the ones that
 * actually happened. A table of ten enum names would be a report about them
 * rather than something they can use.
 */
function countsLine(counts: Record<string, number>): string {
  const named: [string, string][] = [
    ["PROBING_QUESTION", "questions asked"],
    ["PRODUCTIVE_WAIT", "times you waited"],
    ["SPECIFIC_PRAISE", "specific praises"],
    ["GIVES_ANSWER", "answers given"],
    ["GENERIC_PRAISE", "generic praises"],
    ["TAKES_OVER", "stretches you took over"],
  ];

  const parts = named
    .filter(([label]) => (counts[label] ?? 0) > 0)
    .map(([label, words]) => `${counts[label]} ${words}`);

  return parts.length > 0 ? `, ${parts.join(", ")}` : "";
}

/**
 * The definition card.
 *
 * Its own component because it holds state: which of the two expansions is
 * open. A parent who wants to understand the idea and a parent who wants a
 * sentence to say to a nine year old are asking for different things, and
 * making the second one a toggle rather than another turn is the difference
 * between one tap and waiting again.
 */
function Explainer({ card }: { card: Extract<Card, { kind: "explainer" }> }) {
  const [child, setChild] = useState(false);
  const [more, setMore] = useState(false);

  return (
    <article className="pp-card pp-card-explainer">
      <div className="pp-card-body" style={{ paddingTop: 15 }}>
        <p className="pp-explainer-term">{card.term}</p>
        <p className="pp-explainer-short">{child && card.forNineYearOld ? card.forNineYearOld : card.short}</p>

        {!child && more && card.more && (
          <div className="pp-explainer-more">
            <Markdown source={card.more} />
          </div>
        )}

        <div className="pp-explainer-actions">
          {card.more && !child && (
            <button type="button" className="pp-chip pp-chip-quiet" onClick={() => setMore((v) => !v)}>
              {more ? copy.chat.explainerLess : copy.chat.explainerMore}
            </button>
          )}
          {card.forNineYearOld && (
            <button
              type="button"
              className="pp-chip pp-chip-quiet"
              aria-pressed={child}
              onClick={() => setChild((v) => !v)}
            >
              {child ? copy.chat.explainerAdult : copy.chat.explainerChild}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
