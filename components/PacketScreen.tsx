"use client";

import { useState } from "react";

import AudioPrimer from "@/components/AudioPrimer";
import Citation from "@/components/Citation";
import Disclosure from "@/components/Disclosure";
import LockedAnswer from "@/components/LockedAnswer";
import MethodMatch from "@/components/MethodMatch";
import RegisterControl from "@/components/RegisterControl";
import { AlertIcon, BookIcon, ColumnsIcon, LockIcon, SpeechIcon } from "@/components/icons";
import { Banner, Label, Page } from "@/components/ui";
import { useMessages } from "@/components/LocaleProvider";
import { requestPacket } from "@/lib/client/packet";
import { sanitizeSvg } from "@/lib/svg";
import type { RegisterName } from "@/lib/ai/schemas";
import type { PacketBundle } from "@/lib/types";

/**
 * The main screen, which is one question.
 *
 * Above the fold: the problem small, the working small, the question to ask
 * right now as the largest text on the screen, and one primary button.
 * Everything else is a closed disclosure.
 *
 * The previous version opened with a seven-line primer and reached the
 * questions only after a diagram and two five-step method columns. A parent at
 * eight in the evening with a frustrated child does not read that, and a
 * product that feels like homework itself stops being opened.
 */
export default function PacketScreen({ initial }: { initial: PacketBundle }) {
  const t = useMessages();
  const [bundle, setBundle] = useState<PacketBundle>(initial);
  const [register, setRegister] = useState<RegisterName>(initial.packet.register);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /** Which rung of the ladder is showing. Advanced only by "Still stuck". */
  const [rung, setRung] = useState(0);
  const [solved, setSolved] = useState(false);

  const { problem, standard, misconception, packet } = bundle;
  const rungs = packet.hintLadder;
  const question = rungs[Math.min(rung, rungs.length - 1)] ?? "";
  const atLastRung = rung >= rungs.length - 1;

  async function changeRegister(next: RegisterName): Promise<void> {
    if (next === register || busy) return;
    const previous = register;
    setRegister(next);
    setBusy(true);
    setFailed(false);

    try {
      const updated = await requestPacket({ problemId: bundle.problem.id, register: next });
      setBundle(updated);
      setRegister(updated.packet.register);
      // The ladder is re-written at the new register, so the parent stays on
      // the rung they had reached rather than being sent back to the start.
      setRung((current) => Math.min(current, updated.packet.hintLadder.length - 1));
    } catch {
      setRegister(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function markSolved(): void {
    setSolved(true);
    // Best effort. A failed write costs the recap a row, not the parent
    // anything, so it never blocks or reports.
    void fetch("/api/problem", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ problemId: problem.id, status: "SOLVED" }),
    }).catch(() => undefined);
  }

  const misconceptionSvg = sanitizeSvg(misconception?.visualSvg);
  const primerSentences = packet.primer.split(/(?<=\.)\s+/);
  const primerOpening = primerSentences.slice(0, 2).join(" ");
  const primerRest = primerSentences.slice(2).join(" ");

  return (
    <Page>
      {/* ---- The problem, small ------------------------------------- */}
      <header>
        <Label>{standard ? `Grade ${standard.grade}` : "Worksheet"}</Label>
        <p className="pp-transcript" style={{ fontSize: 20, marginTop: 2 }}>{problem.printedText}</p>

        {standard && (
          <div style={{ marginTop: 10 }}>
            <Citation code={standard.code} plainLanguage={standard.plainLanguage} />
          </div>
        )}

        {problem.childWorkText && (
          <pre
            className="pp-transcript"
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--type-small)",
              whiteSpace: "pre-wrap",
              color: "var(--text-on-sheet-muted)",
              borderInlineStart: "1px solid var(--rule-on-sheet)",
              paddingInlineStart: 12,
            }}
          >
            {problem.childWorkText}
          </pre>
        )}
      </header>

      {/* ---- The one thing on the screen ---------------------------- */}
      {solved ? (
        <section style={{ margin: "28px 0 0" }}>
          <h1 style={{ fontSize: "var(--type-h1)", marginBottom: 10 }}>{t.packet.solvedHeading}</h1>
          <p style={{ fontSize: 17, marginBottom: 26 }}>{t.packet.solvedBody}</p>

          <Label>{t.packet.isomorphHeading}</Label>
          <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0" }}>
            {packet.isomorphs.map((text) => (
              <li
                key={text}
                /* An isomorph is an expression the product generated, so it is
                   isolated like a transcription: `2/5 + 1/4` must not be
                   reordered by the Arabic paragraph around it. */
                className="pp-expression"
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--rule-on-sheet)",
                  fontSize: 18,
                }}
              >
                {text}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setSolved(false)}
            style={{
              marginTop: 22,
              padding: "12px 0",
              background: "transparent",
              border: 0,
              color: "var(--text-on-sheet-muted)",
              fontSize: "var(--type-small)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {t.packet.solvedAgain}
          </button>
        </section>
      ) : (
        <section style={{ margin: "26px 0 0", opacity: busy ? 0.45 : 1, transition: "opacity 200ms ease-out" }}>
          <Label>{t.packet.askLabel}</Label>

          {/* The largest text on the screen. This is the product. */}
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 5.5vw, 2.5rem)",
              lineHeight: 1.18,
              letterSpacing: "-0.015em",
              marginTop: 6,
              maxWidth: "20ch",
            }}
          >
            {question}
          </p>

          <p
            style={{
              marginTop: 12,
              fontSize: "var(--type-small)",
              color: "var(--text-on-sheet-muted)",
            }}
          >
            {t.packet.rungCounter(Math.min(rung, rungs.length - 1) + 1, rungs.length)}
          </p>

          <div style={{ marginTop: 22 }}>
            <button
              type="button"
              disabled={atLastRung}
              onClick={() => setRung((n) => Math.min(n + 1, rungs.length - 1))}
              style={{
                width: "100%",
                padding: "17px 22px",
                fontSize: 17,
                fontWeight: 500,
                background: "var(--action)",
                color: "var(--action-label)",
                border: "1px solid var(--action)",
              }}
            >
              {t.packet.stillStuck}
            </button>

            <button
              type="button"
              onClick={markSolved}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "13px 22px",
                fontSize: "var(--type-small)",
                background: "transparent",
                color: "var(--text-on-sheet-muted)",
                border: "1px solid var(--border-interactive)",
              }}
            >
              {t.packet.answeredIt}
            </button>
          </div>

          {atLastRung && (
            <p
              style={{
                marginTop: 16,
                fontSize: "var(--type-small)",
                color: "var(--text-on-sheet-muted)",
              }}
            >
              {t.packet.ladderExhausted}
            </p>
          )}
        </section>
      )}

      {/* ---- Everything below the fold ------------------------------ */}
      <div style={{ marginTop: 34 }}>
        <RegisterControl value={register} onChange={changeRegister} busy={busy} />
      </div>

      {failed && <Banner text={t.errors.generic} />}
      {bundle.notice && <Banner text={bundle.notice} />}

      <div style={{ marginTop: 28 }}>
        {misconception && (
          <Disclosure title={t.packet.discloseWhy} icon={AlertIcon}>
            <h2 style={{ fontSize: "var(--type-h3)", marginBottom: 10 }}>{misconception.plainName}</h2>
            {packet.misconceptionNote && <p style={{ fontSize: 17 }}>{packet.misconceptionNote}</p>}

            {misconceptionSvg && (
              <div
                className="pp-diagram"
                style={{ marginTop: 20 }}
                // Sanitised by lib/svg.ts: allowlisted tags and attributes, no
                // script, no external references, and no literal colour.
                dangerouslySetInnerHTML={{ __html: misconceptionSvg }}
              />
            )}

            <div style={{ marginTop: 20 }}>
              <Label>{t.packet.misconceptionRepair}</Label>
              <p style={{ fontSize: 17 }}>{misconception.repairQuestion}</p>
            </div>
          </Disclosure>
        )}

        <Disclosure title={t.packet.discloseMethods} icon={ColumnsIcon}>
          <MethodMatch data={packet.methodMatch} />
        </Disclosure>

        <Disclosure title={t.packet.discloseTeaching} icon={BookIcon}>
          <div style={{ marginBottom: 20 }}>
            <AudioPrimer problemId={problem.id} register={register} />
          </div>

          <p style={{ fontSize: 17 }}>{primerOpening}</p>
          {primerRest && (
            <details style={{ marginTop: 14 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "var(--type-small)",
                  color: "var(--text-on-sheet-muted)",
                }}
              >
                {t.packet.primerMore}
              </summary>
              <p style={{ fontSize: 17, marginTop: 12 }}>{primerRest}</p>
            </details>
          )}
        </Disclosure>

        <Disclosure title={t.packet.discloseScripts} icon={SpeechIcon}>
          {packet.scripts.map((script) => (
            <div key={script.avoid} style={{ marginBottom: 24 }}>
              <Label>{t.packet.scriptAvoid}</Label>
              <p
                style={{
                  fontSize: 17,
                  color: "var(--text-on-sheet-muted)",
                  textDecoration: "line-through",
                }}
              >
                {script.avoid}
              </p>
              <div style={{ marginTop: 10 }}>
                <Label>{t.packet.scriptUse}</Label>
                <p style={{ fontSize: 17 }}>{script.use}</p>
              </div>
            </div>
          ))}
        </Disclosure>

        <Disclosure title={t.packet.discloseAnswer} icon={LockIcon} tone="quiet">
          <LockedAnswer answer={packet.lockedAnswer} verification={bundle.verification} />
        </Disclosure>
      </div>

      {/* Provenance. Quiet, but never absent: a packet that was not generated
          from this worksheet says so. */}
      {(bundle.source === "fixture" || bundle.source === "generic") && (
        <p
          style={{
            margin: "26px 0 0",
            paddingInlineStart: 12,
            borderInlineStart: "2px solid var(--rule-on-sheet)",
            fontSize: "var(--type-micro)",
            color: "var(--text-on-sheet-muted)",
            maxWidth: "none",
          }}
        >
          {bundle.source === "fixture" ? t.provenance.fixture : t.provenance.generic}
        </p>
      )}
    </Page>
  );
}
