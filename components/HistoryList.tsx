"use client";

import Link from "next/link";
import { useState } from "react";

import { CopyIcon, ShareIcon } from "@/components/icons";
import { appButton, AppLabel } from "@/components/app/AppPage";
import { copy, gradeLabel } from "@/lib/copy";

export interface HistoryRow {
  id: string;
  startedAt: string;
  autonomyScore: number | null;
  parked: boolean;
  moves: number;
  grade: number | null;
  topic: string | null;
  shareToken: string | null;
  shareExpiresAt: string | null;
}

/**
 * Past sessions, newest first, with the share link a parent can hand a
 * teacher. Creating and revoking both happen here, because a link a parent
 * cannot take back is not a link they will create.
 */
export default function HistoryList({ sessions }: { sessions: HistoryRow[] }) {
  const [rows, setRows] = useState(sessions);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function createLink(id: string): Promise<void> {
    setBusy(id);
    try {
      const response = await fetch(`/api/session/${id}/share`, { method: "POST" });
      const data = (await response.json()) as { ok: boolean; token?: string; expiresAt?: string };
      if (data.ok && data.token) {
        setRows((current) =>
          current.map((row) =>
            row.id === id
              ? { ...row, shareToken: data.token ?? null, shareExpiresAt: data.expiresAt ?? null }
              : row,
          ),
        );
      }
    } catch {
      // Leave the row as it was. The parent can try again.
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string): Promise<void> {
    setBusy(id);
    try {
      await fetch(`/api/session/${id}/share`, { method: "DELETE" });
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, shareToken: null, shareExpiresAt: null } : row)),
      );
    } catch {
      // Same.
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p style={{ color: "var(--app-text-dim)", fontSize: 17 }}>{copy.history.empty}</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rows.map((row) => {
        const date = new Date(row.startedAt);
        const shareUrl = row.shareToken
          ? `${typeof window === "undefined" ? "" : window.location.origin}/shared/${row.shareToken}`
          : null;

        return (
          <li key={row.id} style={{ borderTop: "1px solid var(--app-line)", padding: "22px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 500 }}>
                  {date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p style={{ fontSize: "var(--type-small)", color: "var(--app-text-dim)", marginTop: 4 }}>
                  {gradeLabel(row.grade)}
                  {" · "}
                  {copy.history.problemsLabel}: {row.moves}
                  {row.parked ? " · stopped early" : ""}
                </p>
              </div>

              <div style={{ textAlign: "right" }}>
                <AppLabel>{copy.history.ratioLabel}</AppLabel>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 26,
                    color: "var(--accent-ink)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.autonomyScore === null ? "—" : row.autonomyScore.toFixed(2)}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
              <Link href={`/recap/${row.id}`} style={{ fontSize: "var(--type-small)" }}>
                {copy.history.openRecap}
              </Link>

              {shareUrl ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        setCopied(row.id);
                      } catch {
                        setCopied(null);
                      }
                    }}
                    style={{
                      ...appButton("quiet"),
                      padding: "8px 14px",
                      fontSize: "var(--type-small)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CopyIcon size={16} />
                    {copied === row.id ? copy.history.shareCopied : copy.history.shareCopy}
                  </button>
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void revoke(row.id)}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--app-alert-ink)",
                      fontSize: "var(--type-small)",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                      padding: 0,
                    }}
                  >
                    {copy.history.shareRevoke}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => void createLink(row.id)}
                  style={{
                    ...appButton("quiet"),
                    padding: "8px 14px",
                    fontSize: "var(--type-small)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ShareIcon size={16} />
                  {copy.history.shareCreate}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
