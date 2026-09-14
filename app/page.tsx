import Link from "next/link";

import { LogoMark } from "@/components/Logo";
import { buttonStyle, Page, Section } from "@/components/ui";
import { copy } from "@/lib/copy";

export default function LandingPage() {
  return (
    <Page>
      <section style={{ padding: "56px 0 44px" }}>
        <div style={{ marginBottom: 26 }}>
          <LogoMark size={64} />
        </div>

        <h1 style={{ marginBottom: 22 }}>{copy.brand.tagline}</h1>
        <p style={{ fontSize: 19, marginBottom: 26 }}>{copy.landing.thesis}</p>

        <p
          style={{
            borderLeft: "1px solid var(--rule)",
            paddingLeft: 16,
            fontSize: 16,
            color: "var(--muted)",
          }}
        >
          {copy.landing.audioPromise}
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 34 }}>
          <Link href="/problem/demo" style={{ ...buttonStyle("primary"), textDecoration: "none" }}>
            {copy.landing.tryButton}
          </Link>
          <Link href="/setup" style={{ ...buttonStyle("secondary"), textDecoration: "none" }}>
            {copy.landing.secondaryCta}
          </Link>
        </div>
        <p style={{ marginTop: 14, fontSize: 14, color: "var(--muted)" }}>{copy.landing.tryNote}</p>
      </section>

      <Section title={copy.landing.researchHeading}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {copy.landing.research.map((item) => (
            <li key={item.source} style={{ padding: "20px 0", borderBottom: "1px solid var(--rule)" }}>
              <p style={{ fontSize: 17, marginBottom: 8 }}>{item.claim}</p>
              <p style={{ fontSize: 14, color: "var(--muted)" }}>{item.source}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What it does">
        <ol style={{ paddingLeft: 22, fontSize: 17, margin: 0 }}>
          <li style={{ marginBottom: 14 }}>
            You photograph the worksheet, including whatever your child has already written.
          </li>
          <li style={{ marginBottom: 14 }}>
            You check our transcription of their working, and fix it in one tap if we misread a line.
          </li>
          <li style={{ marginBottom: 14 }}>
            You get a primer on what is being taught, your method and the class&apos;s method side by
            side, and five questions to ask in order.
          </li>
          <li style={{ marginBottom: 14 }}>
            The answer sits behind a press and hold, because reaching for it is the easy thing to do
            and the one thing that ends the learning.
          </li>
          <li>
            Live Mode listens while you work and says something only when it is worth interrupting
            for. Three times a session, at most.
          </li>
        </ol>
      </Section>

      <Section title="What it will not do">
        <p style={{ fontSize: 17, marginBottom: 14 }}>{copy.landing.noChild}</p>
        <p style={{ fontSize: 17, color: "var(--muted)" }}>
          Everything here is addressed to you. There is no screen for your child to read, no chat for
          them to type into, and nothing for them to log into. The research is clear that the adult in
          the room is the variable that matters, so the adult in the room is who we talk to.
        </p>
      </Section>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 36 }}>
        <Link href="/capture" style={{ ...buttonStyle("primary", true), textDecoration: "none", display: "block", textAlign: "center" }}>
          {copy.landing.primaryCta}
        </Link>
      </div>
    </Page>
  );
}
