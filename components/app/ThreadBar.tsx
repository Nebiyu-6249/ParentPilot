"use client";

import RegisterControl from "@/components/RegisterControl";
import ShareSheet from "@/components/app/ShareSheet";
import { PanelIcon, ShareIcon } from "@/components/icons";
import { copy } from "@/lib/copy";
import type { RegisterName } from "@/lib/ai/schemas";
import type { CurrentProblem } from "@/lib/thread";

/**
 * The thread's top bar.
 *
 * It is the tab on the folder, not a control panel. It says which worksheet
 * this thread is about, and it holds the two things that apply to the whole
 * thread rather than to one card: how the product writes to you, and sending
 * it on to the teacher. Both sit at the far edge, out of the path of a thumb
 * moving between the thread and the composer during a session.
 *
 * It takes the sidebar's ground rather than the thread's. Chrome then wraps
 * the thread on two sides and the thread column is the only white in the
 * surface, which is this product's own paper-on-a-desk idea carried into the
 * app layer. The alternative separations were a border alone, which is what
 * was there and read as nothing, and a translucent blur, which is the
 * glassmorphism the brief bans.
 */
export default function ThreadBar({
  title,
  problem,
  register,
  onRegisterChange,
  railOpen,
  onToggleRail,
  shareOpen,
  onShareOpen,
  onShareClose,
}: {
  title: string;
  /** Null until a worksheet has been read. Share does not appear before then. */
  problem: CurrentProblem | null;
  register: RegisterName;
  onRegisterChange: (next: RegisterName) => void;
  railOpen: boolean;
  onToggleRail: () => void;
  shareOpen: boolean;
  onShareOpen: () => void;
  onShareClose: () => void;
}) {
  return (
    <header className="pp-topbar">
      {!railOpen && (
        <button
          type="button"
          onClick={onToggleRail}
          aria-label="Open sidebar"
          className="pp-composer-btn pp-topbar-toggle"
        >
          <PanelIcon size={16} />
        </button>
      )}

      <span className="pp-topbar-title">{title}</span>

      <div className="pp-topbar-actions">
        <RegisterControl value={register} onChange={onRegisterChange} compact />

        {/* Absent rather than disabled on an empty thread. A dead grey button
            is an offer the product cannot keep, and the bar still carries the
            register control, so it is not an empty bar either.

            Labelled on the button itself, because the visible label is
            display:none at phone width and that takes it out of the
            accessibility tree along with the pixels. */}
        {problem && (
          <button
            type="button"
            className="pp-topbar-share"
            aria-label={copy.chat.share}
            title={copy.chat.share}
            onClick={onShareOpen}
          >
            <ShareIcon size={16} />
            <span className="pp-topbar-share-label" aria-hidden="true">
              {copy.chat.share}
            </span>
          </button>
        )}
      </div>

      {shareOpen && problem && (
        <ShareSheet problem={problem} register={register} onClose={onShareClose} />
      )}
    </header>
  );
}
