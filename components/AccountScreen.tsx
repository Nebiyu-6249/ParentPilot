"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AccountIcon, HistoryIcon, SettingsIcon } from "@/components/icons";
import { appButton, AppLabel, AppPage, AppSection } from "@/components/app/AppPage";
import { copy, gradeLabel } from "@/lib/copy";
import type { RegisterName } from "@/lib/ai/schemas";

interface ChildProfile {
  id: string;
  firstName: string | null;
  grade: number | null;
  curriculum: string;
}

/**
 * The account screen.
 *
 * Children appear here as profiles and nothing more. There is no invite, no
 * credential, no "child login" affordance to add later, because the schema has
 * nowhere to put one.
 */
export default function AccountScreen({
  email,
  register,
  language,
  anxietyBand,
  children,
}: {
  email: string | null;
  register: RegisterName;
  language: string;
  anxietyBand: number;
  children: ChildProfile[];
}) {
  const router = useRouter();

  async function signOut(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  return (
    <AppPage title={copy.account.heading}>

      <AppSection title={email ? copy.account.signedInAs : copy.account.signIn}>
        {email ? (
          <>
            <p style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17 }}>
              <AccountIcon size={20} style={{ color: "var(--accent-ink)" }} />
              {email}
            </p>
            <button type="button" onClick={signOut} style={{ ...appButton("quiet"), marginTop: 20 }}>
              {copy.account.signOut}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 17, marginBottom: 18 }}>{copy.account.anonymous}</p>
            <Link href="/login" style={{ ...appButton("primary"), textDecoration: "none", display: "inline-block" }}>
              {copy.account.signIn}
            </Link>
          </>
        )}
      </AppSection>

      <AppSection title={copy.account.childrenHeading} note={copy.account.childNote}>
        {children.length === 0 ? (
          <p style={{ color: "var(--app-text-dim)" }}>{copy.account.noChildren}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {children.map((child) => (
              <li
                key={child.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "14px 0",
                  borderBottom: "1px solid var(--app-line)",
                  fontSize: 17,
                }}
              >
                <span>{child.firstName ?? "Your child"}</span>
                <span style={{ color: "var(--app-text-dim)", fontSize: "var(--type-small)" }}>
                  {gradeLabel(child.grade)} · {child.curriculum}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AppSection>

      <AppSection title={copy.account.preferencesHeading}>
        <p style={{ fontSize: 17, marginBottom: 6 }}>
          {copy.register.options.find((o) => o.value === register)?.label ?? register}
          {" · "}
          {language.toUpperCase()}
          {" · "}
          {copy.setup.step2.options.find((o) => o.band === anxietyBand)?.label ?? ""}
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/settings" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--type-small)" }}>
            <SettingsIcon size={18} />
            Change these in Settings
          </Link>
          <Link href="/history" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--type-small)" }}>
            <HistoryIcon size={18} />
            Past sessions
          </Link>
        </div>
      </AppSection>

      <div style={{ borderTop: "1px solid var(--app-line)", paddingTop: 22 }}>
        <AppLabel>Your data</AppLabel>
        <p style={{ fontSize: "var(--type-small)", color: "var(--app-text-dim)", marginTop: 6 }}>
          Export and delete live in <Link href="/settings">Settings</Link>, and both still work exactly
          as the privacy page describes.
        </p>
      </div>
    </AppPage>
  );
}
