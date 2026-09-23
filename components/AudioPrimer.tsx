"use client";

import { useRef, useState } from "react";

import { PauseIcon, PlayIcon } from "@/components/icons";
import { useMessages } from "@/components/LocaleProvider";
import type { RegisterName } from "@/lib/ai/schemas";

/**
 * Play control for the spoken primer.
 *
 * Nothing is generated until the parent asks, so a screen that is never
 * listened to costs nothing. The audio is fetched on first press and cached
 * server side on the packet key, so the second listen is instant and free.
 */
export default function AudioPrimer({
  problemId,
  register,
}: {
  problemId: string;
  register: RegisterName;
}) {
  const t = useMessages();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "unavailable">("idle");

  async function toggle(): Promise<void> {
    const existing = audioRef.current;

    if (existing) {
      if (existing.paused) {
        await existing.play().catch(() => setState("unavailable"));
        setState("playing");
      } else {
        existing.pause();
        setState("paused");
      }
      return;
    }

    setState("loading");
    try {
      const response = await fetch(
        `/api/audio?problemId=${encodeURIComponent(problemId)}&register=${register}`,
      );
      if (!response.ok) {
        setState("unavailable");
        return;
      }

      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setState("paused");
      audioRef.current = audio;

      await audio.play();
      setState("playing");
    } catch {
      setState("unavailable");
    }
  }

  if (state === "unavailable") {
    return (
      <p style={{ fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)" }}>
        {t.audio.unavailable}
      </p>
    );
  }

  const label =
    state === "loading" ? t.audio.loading : state === "playing" ? t.audio.pause : t.audio.play;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={state === "loading"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          fontSize: 17,
          background: "transparent",
          color: "var(--action)",
          border: "1px solid var(--action)",
        }}
      >
        {state === "playing" ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        {label}
      </button>
      <p style={{ marginTop: 10, fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)" }}>
        {t.audio.help}
      </p>
    </div>
  );
}
