"use client";

import { useState } from "react";

import { AppBanner, appButton, appInput, AppLabel, AppPage } from "@/components/app/AppPage";
import { copy } from "@/lib/copy";

type LoginCopyKey = keyof typeof copy.login;

/**
 * Email, and a link. No password to forget and nothing to reset.
 *
 * The response is the same whether or not the address is known, so this screen
 * cannot be used to find out who has an account.
 */
export default function LoginForm({ errorKey }: { errorKey: LoginCopyKey | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(
    errorKey ? String(copy.login[errorKey]) : null,
  );
  const [failed, setFailed] = useState(Boolean(errorKey));

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!email.trim() || state === "sending") return;

    setState("sending");
    setFailed(false);

    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await response.json()) as { ok: boolean; message: string };
      setMessage(data.message);
      setFailed(!data.ok);
      setState(data.ok ? "done" : "idle");
    } catch {
      setMessage(copy.login.failed);
      setFailed(true);
      setState("idle");
    }
  }

  return (
    <AppPage title={copy.login.heading}>
      <p className="pp-appview-note" style={{ marginBottom: 20 }}>{copy.login.help}</p>

      {message && <AppBanner text={message} tone={failed ? "alert" : "quiet"} />}

      {state === "done" ? (
        <p style={{ marginTop: 20, color: "var(--app-text-dim)", fontSize: "var(--type-small)" }}>
          {copy.login.sentQuiet}
        </p>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 22 }}>
          <AppLabel>{copy.login.emailLabel}</AppLabel>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ ...appInput, marginBottom: 16 }}
          />
          <button type="submit" disabled={state === "sending"} style={appButton("primary", true)}>
            {state === "sending" ? copy.common.loading : copy.login.submit}
          </button>
        </form>
      )}

      <p
        style={{
          marginTop: 30,
          paddingTop: 22,
          borderTop: "1px solid var(--app-line)",
          fontSize: "var(--type-small)",
          color: "var(--app-text-dim)",
        }}
      >
        {copy.login.anonymousNote}
      </p>
    </AppPage>
  );
}
