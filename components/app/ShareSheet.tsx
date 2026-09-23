"use client";

import { useEffect, useRef, useState } from "react";

import { CloseIcon, CopyIcon } from "@/components/icons";
import { useMessages } from "@/components/LocaleProvider";
import type { RegisterName } from "@/lib/ai/schemas";
import type { CurrentProblem } from "@/lib/thread";

/**
 * Sending a thread on to the teacher.
 *
 * A native `<dialog>` rather than a div with a z-index: focus trapping, the
 * Escape key, inertness of the page behind and the top layer are all free and
 * all correct, which is four things not to get wrong by hand.
 *
 * The note is a draft in a textarea, not a paragraph. A parent who cannot
 * change a word before sending it under their own name is being asked to
 * forward a machine's opinion of their child to a teacher, which is the
 * opposite of what this product is for.
 */
export default function ShareSheet({
  problem,
  register,
  onClose,
}: {
  problem: CurrentProblem;
  register: RegisterName;
  onClose: () => void;
}) {
  const t = useMessages();
  const ref = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"drafting" | "ready" | "failed">("drafting");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const response = await fetch("/api/thread/note", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ problemId: problem.problemId, register }),
        });
        const data = (await response.json()) as { ok: boolean; note?: string; message?: string };
        if (!live) return;

        if (data.ok && data.note) {
          setNote(data.note);
          setState("ready");
        } else {
          setMessage(data.message ?? t.chat.shareFailed);
          setState("failed");
        }
      } catch {
        if (!live) return;
        setMessage(t.chat.shareFailed);
        setState("failed");
      }
    })();

    return () => {
      live = false;
    };
  }, [problem.problemId, register]);

  async function copyNote(): Promise<void> {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
    } catch {
      // Clipboard permission refused. The textarea is selectable, so there is
      // still a way to take the note, and pretending it copied would be worse.
      setCopied(false);
    }
  }

  return (
    <dialog ref={ref} className="pp-dialog" onClose={onClose} aria-labelledby="pp-share-heading">
      <div className="pp-dialog-head">
        <h2 id="pp-share-heading" className="pp-dialog-title">
          {t.chat.shareHeading}
        </h2>
        <button
          type="button"
          className="pp-composer-btn"
          aria-label={t.chat.shareClose}
          onClick={() => ref.current?.close()}
          style={{ width: 32, height: 32 }}
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="pp-dialog-body">
        <p style={{ fontSize: 13.5, color: "var(--app-text-dim)", margin: "0 0 14px" }}>
          {t.chat.shareHelp}
        </p>

        {state === "drafting" && (
          <p role="status" aria-live="polite" style={{ fontSize: 14, color: "var(--app-text-dim)" }}>
            {t.chat.shareDrafting}
            <span aria-hidden="true">…</span>
          </p>
        )}

        {state === "failed" && (
          <p role="status" style={{ fontSize: 14, color: "var(--app-alert-ink)" }}>
            {message}
          </p>
        )}

        {state === "ready" && (
          <>
            <label className="pp-dialog-label" htmlFor="pp-share-note">
              {problem.printedText}
            </label>
            <textarea
              id="pp-share-note"
              className="pp-dialog-note"
              value={note}
              rows={9}
              onChange={(event) => {
                setNote(event.target.value);
                setCopied(false);
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button type="button" className="pp-dialog-action" onClick={copyNote}>
                <CopyIcon size={16} />
                {copied ? t.chat.shareCopied : t.chat.shareCopy}
              </button>
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: "var(--app-text-dim)", margin: "16px 0 0" }}>
          {t.chat.shareFooter}
        </p>
      </div>
    </dialog>
  );
}
