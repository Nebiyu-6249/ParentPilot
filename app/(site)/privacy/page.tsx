import type { Metadata } from "next";

import { SiteBody, SiteHero, SiteSection } from "@/components/site/SitePage";

export const metadata: Metadata = { title: "Privacy and cookies" };

/**
 * The privacy page.
 *
 * Every claim here is a claim about code that exists in this repository, and
 * the file that backs it is now actually named rather than merely promised.
 * `scripts/check.ts` reads the paths off this page and fails if one of them
 * does not exist, so a file that moves takes the page down with it instead of
 * leaving a citation pointing at nothing.
 *
 * If a claim below stops being true, the page is wrong and must change in the
 * same commit as the code.
 */
export default function PrivacyPage() {
  return (
    <main>
      <SiteHero
        title="What we keep, and what we cannot keep"
        standfirst="Plain language, no legalese. Every section below names the file that makes it true."
      />

      <SiteBody>

      <SiteSection title="Worksheet photos" first>
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          When you photograph a worksheet, the image is sent to OpenAI so it can be read. Before it
          leaves our server we strip the metadata out of it, which on a phone photo usually includes
          GPS coordinates, a capture time and a device identifier. The pixels are untouched, the
          metadata is gone.
        </p>
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          We do not keep the photo. Once it has been read, the image is discarded and only the text
          we read off it is stored: the printed question, your child&apos;s working, and how confident
          we were about reading it. There is no image storage bucket in this product.
        </p>
        <p style={{ fontSize: 16, color: "var(--muted)" }}>
          OpenAI processes the image under their API terms. We do not use your worksheets to train
          anything.
        </p>
        <p style={{ marginTop: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <code className="pp-source-file">lib/exif.ts</code>
        <code className="pp-source-file">app/api/thread/turn/route.ts</code>
        </p>
      </SiteSection>

      <SiteSection title="Live Mode audio">
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          In Chrome, Edge and Safari, Live Mode uses the speech recognition built into your browser.
          The audio never leaves your device. Nothing is uploaded, nothing is recorded, and there is
          no audio file at any point.
        </p>
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          In browsers without that feature, we fall back to sending three second audio chunks to be
          transcribed. Those chunks are transcribed and dropped in the same request. They are not
          written to disk and not written to the database.
        </p>
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          Either way, the text is held in memory in your browser for thirty seconds and then
          discarded. What we store is a label saying what kind of thing was said, a confidence
          number, and how many seconds into the session it happened. That is all.
        </p>
        <p style={{ fontSize: 16, color: "var(--muted)" }}>
          There is no column in our database that can hold a transcript. The table that records
          conversational moves has no text field at all, so this is not a policy we are asking you to
          trust, it is a shape the database is in.
        </p>
        <p style={{ marginTop: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <code className="pp-source-file">lib/live/useLiveTranscript.ts</code>
        <code className="pp-source-file">prisma/schema.prisma</code>
        </p>
      </SiteSection>

      <SiteSection title="Your child">
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          No account is created for your child. There is no student login, no child-facing screen,
          and nothing for them to sign into. We store a grade level, a curriculum, the subjects you
          picked, and a first name if you chose to give one. The first name is used only inside the
          scripts we write for you to say out loud.
        </p>
        <p style={{ fontSize: 16, color: "var(--muted)" }}>
          The AI in this product never addresses your child. That rule is written into every prompt
          file, not just into the interface.
        </p>
        <p style={{ marginTop: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <code className="pp-source-file">prompts/_standing-rules.md</code>
        </p>
      </SiteSection>

      <SiteSection title="Cookies">
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          One cookie, called <code>pp_session</code>. It holds an identifier for your profile and
          nothing else. Without it we cannot tell your worksheets from anyone else&apos;s, which makes
          it strictly necessary.
        </p>
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          There is no analytics, no tracking pixel, no advertising tag and no third party script on
          any page of this site. That is why you are reading a disclosure rather than clicking
          through a consent banner: strictly necessary cookies require telling you, not asking you.
        </p>
        <p style={{ fontSize: 16, color: "var(--muted)" }}>
          If analytics are ever added, this stops being true and a consent banner becomes mandatory.
        </p>
        <p style={{ marginTop: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <code className="pp-source-file">lib/session.ts</code>
        </p>
      </SiteSection>

      <SiteSection title="Getting your data out, or deleting it">
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          Both controls are in <a href="/settings">Settings</a>, and both actually work. Export gives
          you a JSON file with everything we hold about you and your children. Delete removes your
          profile, your children&apos;s profiles, every worksheet, every problem, every packet and
          every session, and it cannot be undone.
        </p>
        <p style={{ marginTop: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <code className="pp-source-file">app/api/account/route.ts</code>
        </p>
      </SiteSection>

      <SiteSection title="Who we share with">
        <p style={{ fontSize: 17, marginBottom: 14 }}>
          OpenAI, for reading worksheets and writing your primer, and for fallback transcription in
          browsers that need it. Our hosting and database providers, because the app runs on their
          machines. Nobody else. We do not sell anything to anyone.
        </p>
        <p style={{ marginTop: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <code className="pp-source-file">lib/ai/provider.ts</code>
        </p>
      </SiteSection>
      </SiteBody>
    </main>
  );
}
