"use client";

import { useState } from "react";

import { CopyIcon, PlayIcon, SendIcon, ShareIcon } from "@/components/icons";
import { Label } from "@/components/ui";
import { copy } from "@/lib/copy";

/**
 * What can be made from a session.
 *
 * Named outputs in one place rather than buttons scattered across the recap,
 * so a parent can see the whole set at a glance and pick one. Nothing is
 * generated until they do.
 *
 * The list stops where the product stops. There are no flashcards, no quiz and
 * no revision deck here, because those are artifacts for a learner to study
 * from and this product does not address the learner.
 */
export default function StudioPanel({
  sessionId,
  teacherNote,
  shareToken,
}: {
  sessionId: string;
  teacherNote: string | null;
  shareToken: string | null;
}) {
  const [token, setToken] = useState(shareToken);
  const [copied, setCopied] = useState<"note" | "link" | null>(null);
  const [busy, setBusy] = useState(false);

  const shareUrl = token
    ? `${typeof window === "undefined" ? "" : window.location.origin}/shared/${token}`
    : null;

  async function createLink(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(`/api/session/${sessionId}/share`, { method: "POST" });
      const data = (await response.json()) as { ok: boolean; token?: string };
      if (data.ok && data.token) setToken(data.token);
    } catch {
      // Leave it unset; the parent can try again.
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, which: "note" | "link"): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section style={{ borderTop: "1px solid var(--rule-on-sheet)", padding: "30px 0" }}>
      <h2 style={{ fontSize: "var(--type-h2)", marginBottom: 8 }}>{copy.studio.heading}</h2>
      <p style={{ fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)", marginBottom: 20 }}>
        {copy.studio.help}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li style={{ padding: "18px 0", borderTop: "1px solid var(--rule-on-sheet)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <SendIcon size={20} style={{ color: "var(--action)" }} />
            <span style={{ fontSize: 17, fontWeight: 500 }}>{copy.studio.teacherNote}</span>
          </span>

          {teacherNote ? (
            <>
              <p style={{ whiteSpace: "pre-wrap", fontSize: 16 }}>{teacherNote}</p>
              <button
                type="button"
                onClick={() => void copyText(teacherNote, "note")}
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 14px",
                  fontSize: "var(--type-small)",
                  background: "transparent",
                  color: "var(--action)",
                  border: "1px solid var(--border-interactive)",
                }}
              >
                <CopyIcon size={16} />
                {copied === "note" ? copy.live.parkCopied : copy.live.parkCopy}
              </button>
            </>
          ) : (
            <p style={{ fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)" }}>
              A note is drafted when a session is stopped early.
            </p>
          )}
        </li>

        <li style={{ padding: "18px 0", borderTop: "1px solid var(--rule-on-sheet)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <ShareIcon size={20} style={{ color: "var(--action)" }} />
            <span style={{ fontSize: 17, fontWeight: 500 }}>{copy.studio.shareLink}</span>
          </span>

          {shareUrl ? (
            <>
              <p
                style={{
                  fontSize: "var(--type-small)",
                  color: "var(--text-on-sheet-muted)",
                  wordBreak: "break-all",
                }}
              >
                {shareUrl}
              </p>
              <button
                type="button"
                onClick={() => void copyText(shareUrl, "link")}
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 14px",
                  fontSize: "var(--type-small)",
                  background: "transparent",
                  color: "var(--action)",
                  border: "1px solid var(--border-interactive)",
                }}
              >
                <CopyIcon size={16} />
                {copied === "link" ? copy.history.shareCopied : copy.history.shareCopy}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={createLink}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                fontSize: "var(--type-small)",
                background: "transparent",
                color: "var(--action)",
                border: "1px solid var(--border-interactive)",
              }}
            >
              <ShareIcon size={16} />
              {copy.history.shareCreate}
            </button>
          )}
        </li>

        <li style={{ padding: "18px 0", borderTop: "1px solid var(--rule-on-sheet)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <PlayIcon size={20} style={{ color: "var(--action)" }} />
            <span style={{ fontSize: 17, fontWeight: 500 }}>{copy.studio.audioPrimer}</span>
          </span>
          <p style={{ fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)" }}>
            Open a worksheet to hear its primer read aloud.
          </p>
        </li>
      </ul>

      <Label>Not here on purpose</Label>
      <p style={{ marginTop: 6, fontSize: "var(--type-micro)", color: "var(--text-on-sheet-muted)" }}>
        No flashcards, no quiz, no revision deck. Those are things for a learner to study from, and
        this product does not speak to the learner.
      </p>
    </section>
  );
}
