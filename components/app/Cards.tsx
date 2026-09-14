"use client";

import { useState, type ReactNode } from "react";

import AudioPrimer from "@/components/AudioPrimer";
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
  SpeechIcon,
  TypeIcon,
  type IconProps,
} from "@/components/icons";
import { copy } from "@/lib/copy";
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

/** mm:ss, so a nudge says when in the session it was earned. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * The drafted note for the teacher, with the copy control.
 *
 * A parent who has just been told to stop is not going to retype this, and
 * the whole point of the note is that they send it.
 */
function TeacherNote({ note }: { note: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--app-line)", paddingTop: 14 }}>
      <p style={{ fontSize: 13, color: "var(--app-text-dim)", marginBottom: 8 }}>
        {copy.live.parkNoteHeading}
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", maxWidth: "58ch" }}>{note}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(note);
            setCopied(true);
          } catch {
            // No clipboard permission. The note is on screen to select by hand.
            setCopied(false);
          }
        }}
        style={{
          marginTop: 12,
          padding: "9px 15px",
          borderRadius: "var(--r-control)",
          border: "1px solid var(--app-border-interactive)",
          background: "transparent",
          color: "var(--app-text)",
          fontSize: 14,
        }}
      >
        {copied ? copy.live.parkCopied : copy.live.parkCopy}
      </button>
    </div>
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

    /* The reply to something the parent typed. Unwrapped: a reply that arrives
       collapsed behind a heading is not a reply. */
    case "coach":
      return (
        <article className="pp-card pp-card-coach">
          <div className="pp-card-body">
            <p style={{ fontSize: 15.5, lineHeight: 1.6, maxWidth: "62ch" }}>{card.reply}</p>

            {/* Label above the sentence, the same order as the ask card. It is
                the same act in both places and it should read the same way. */}
            {card.sayThis && (
              <>
                <p style={{ marginTop: 16, fontSize: 13, color: "var(--accent-ink)" }}>
                  {copy.packet.askLabel}
                </p>
                <p className="pp-ask-question" style={{ marginTop: 6 }}>
                  {card.sayThis}
                </p>
              </>
            )}

            {card.watchFor && (
              <p
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid var(--app-line)",
                  fontSize: 13.5,
                  color: "var(--app-text-dim)",
                  maxWidth: "62ch",
                }}
              >
                {copy.chat.watchForLabel} {card.watchFor}
              </p>
            )}
          </div>
        </article>
      );

    case "text":
      return <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: "68ch" }}>{card.body}</p>;

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
                  border: "1px solid var(--app-action)",
                  background: "var(--app-action)",
                  color: "var(--app-action-label)",
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

          {/* The same explanation through the ear, for a parent who reads
              English with difficulty. It existed only on the screen the thread
              replaced, which meant the chat surface quietly dropped the most
              valuable thing in the product for the people it helps most. */}
          <div style={{ marginTop: 12 }}>
            <AudioPrimer problemId={card.problemId} register={card.register} />
          </div>

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

    /* A nudge that arrived while Live Mode was listening. Never collapsed:
       it is coaching for the next thirty seconds, and a heading to open would
       make it useless by the time the parent opened it. */
    case "live_card":
      return (
        <article className="pp-card pp-card-live">
          <div className="pp-card-body" style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            <SpeechIcon size={18} style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, maxWidth: "58ch" }}>{card.text}</p>
              <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--app-text-dim)" }}>
                {copy.live.heardAt} {clock(card.tOffset)}
              </p>
            </div>
          </div>
        </article>
      );

    case "live_summary":
      return (
        <Shell title={copy.recap.heading} icon={CheckIcon} defaultOpen>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "var(--accent-ink)", lineHeight: 1 }}>
            {card.autonomyScore.toFixed(2)}
          </p>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--app-text-dim)" }}>
            {copy.recap.ratioLabel}, {copy.live.overMinutes(card.minutes)}
          </p>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, maxWidth: "58ch" }}>{card.reading}</p>

          {/* Written from move counts alone. The model that wrote it has never
              seen a word the child said, and there is no transcript for it to
              have seen. */}
          {card.recap && (
            <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6, maxWidth: "58ch" }}>{card.recap}</p>
          )}

          {card.oneThingToTry && (
            <>
              <p style={{ marginTop: 16, fontSize: 13, color: "var(--accent-ink)" }}>
                {copy.live.oneThingLabel}
              </p>
              <p className="pp-ask-question" style={{ marginTop: 6, fontSize: "1.2rem", maxWidth: "30ch" }}>
                {card.oneThingToTry}
              </p>
            </>
          )}

          {card.sessionId && (
            <p style={{ marginTop: 16, fontSize: 14 }}>
              <a href={`/recap/${card.sessionId}`}>{copy.live.fullRecap}</a>
            </p>
          )}
        </Shell>
      );

    case "park_it":
      return (
        <article className="pp-card pp-card-park">
          <div className="pp-card-body" style={{ paddingTop: 16 }}>
            <h3 style={{ fontSize: 16, color: "var(--app-alert-ink)", marginBottom: 8 }}>
              {copy.live.parkHeading}
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: "58ch" }}>{copy.live.parkBody}</p>

            {card.teacherNote && <TeacherNote note={card.teacherNote} />}
          </div>
        </article>
      );

    default:
      return null;
  }
}
