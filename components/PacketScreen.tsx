"use client";

import { useState } from "react";

import HintLadder from "@/components/HintLadder";
import LockedAnswer from "@/components/LockedAnswer";
import MethodMatch from "@/components/MethodMatch";
import RegisterControl from "@/components/RegisterControl";
import { Banner, Label, Page, Section } from "@/components/ui";
import { copy } from "@/lib/copy";
import { sanitizeSvg } from "@/lib/svg";
import { requestPacket } from "@/lib/client/packet";
import type { RegisterName } from "@/lib/ai/schemas";
import type { PacketBundle } from "@/lib/types";

/**
 * The main screen.
 *
 * Client-side so the register control can swap every parent-facing string
 * without a page reload: changing register refetches the packet at the new
 * register and replaces the bundle in place. Cached registers come back
 * instantly, and the demo fixture carries all three, so on the landing demo
 * the control is instant and free.
 */
export default function PacketScreen({ initial }: { initial: PacketBundle }) {
  const [bundle, setBundle] = useState<PacketBundle>(initial);
  const [register, setRegister] = useState<RegisterName>(initial.packet.register);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

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
    } catch {
      // Keep the copy the parent is already reading rather than blanking the
      // screen. The control snaps back so it never lies about what is shown.
      setRegister(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const { problem, standard, misconception, packet } = bundle;
  const misconceptionSvg = sanitizeSvg(misconception?.visualSvg);

  return (
    <Page>
      <header style={{ padding: "32px 0 26px" }}>
        <Label>{standard ? `Grade ${standard.grade}` : "Worksheet"}</Label>
        <h1 style={{ fontSize: "clamp(1.8rem, 6vw, 2.4rem)" }}>{problem.printedText}</h1>
        {problem.childWorkText && (
          <div style={{ marginTop: 20 }}>
            <Label>{copy.transcription.workLabel}</Label>
            <pre
              style={{
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                whiteSpace: "pre-wrap",
                color: "var(--muted)",
                borderLeft: "1px solid var(--rule)",
                paddingLeft: 14,
              }}
            >
              {problem.childWorkText}
            </pre>
          </div>
        )}
      </header>

      {bundle.notice && <Banner text={bundle.notice} />}
      {failed && <Banner text={copy.errors.generic} />}

      <div style={{ borderTop: "1px solid var(--rule)", padding: "24px 0" }}>
        <RegisterControl value={register} onChange={changeRegister} busy={busy} />
      </div>

      <div style={{ opacity: busy ? 0.45 : 1, transition: "opacity 200ms ease-out" }}>
        <Section title={copy.packet.primerHeading}>
          <p style={{ fontSize: 17 }}>{packet.primer}</p>
        </Section>

        {misconception && (
          <Section title={copy.packet.misconceptionHeading}>
            <h3 style={{ marginBottom: 10 }}>{misconception.plainName}</h3>
            {packet.misconceptionNote && <p style={{ fontSize: 17 }}>{packet.misconceptionNote}</p>}
            {misconceptionSvg && (
              <div
                className="pp-diagram"
                style={{ marginTop: 20 }}
                // Hand-written fixture SVG, still passed through the same
                // sanitiser as model output so there is one code path.
                dangerouslySetInnerHTML={{ __html: misconceptionSvg }}
              />
            )}
            <div style={{ marginTop: 20 }}>
              <Label>{copy.packet.misconceptionRepair}</Label>
              <p style={{ fontSize: 17 }}>{misconception.repairQuestion}</p>
            </div>
          </Section>
        )}

        <Section title={copy.packet.methodHeading}>
          <MethodMatch data={packet.methodMatch} />
        </Section>

        <Section title={copy.packet.hintHeading} note={copy.packet.hintHelp}>
          <HintLadder rungs={packet.hintLadder} />
        </Section>

        <Section title={copy.packet.scriptsHeading}>
          {packet.scripts.map((script) => (
            <div key={script.avoid} style={{ marginBottom: 26 }}>
              <Label>{copy.packet.scriptAvoid}</Label>
              <p style={{ fontSize: 17, color: "var(--muted)", textDecoration: "line-through" }}>
                {script.avoid}
              </p>
              <div style={{ marginTop: 12 }}>
                <Label>{copy.packet.scriptUse}</Label>
                <p style={{ fontSize: 17 }}>{script.use}</p>
              </div>
            </div>
          ))}
        </Section>

        <Section title={copy.packet.answerHeading}>
          <LockedAnswer answer={packet.lockedAnswer} verification={bundle.verification} />
        </Section>

        <Section title={copy.packet.isomorphHeading} note={copy.packet.isomorphHelp}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {packet.isomorphs.map((problemText) => (
              <li
                key={problemText}
                style={{ padding: "14px 0", borderBottom: "1px solid var(--rule)", fontSize: 18 }}
              >
                {problemText}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </Page>
  );
}
