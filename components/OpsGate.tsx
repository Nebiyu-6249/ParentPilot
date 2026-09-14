"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Banner, buttonStyle, inputStyle, Label, Page } from "@/components/ui";
import { copy } from "@/lib/copy";

export default function OpsGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);

  async function submit(): Promise<void> {
    setWrong(false);
    const response = await fetch("/api/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);

    if (response?.ok) router.refresh();
    else setWrong(true);
  }

  return (
    <Page>
      <header style={{ padding: "48px 0 24px" }}>
        <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{copy.ops.heading}</h1>
      </header>

      {wrong && <Banner tone="alert" text={copy.ops.wrong} />}

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 26 }}>
        <Label>{copy.ops.passwordLabel}</Label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          style={{ ...inputStyle, marginBottom: 16 }}
        />
        <button type="button" onClick={submit} style={buttonStyle("primary", true)}>
          {copy.ops.enter}
        </button>
      </div>
    </Page>
  );
}
