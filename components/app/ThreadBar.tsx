"use client";

import RegisterControl from "@/components/RegisterControl";
import ShareSheet from "@/components/app/ShareSheet";
import { EarIcon, PanelIcon, ShareIcon } from "@/components/icons";
import { useMessages } from "@/components/LocaleProvider";
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
  liveListening,
  liveDisabled,
  onLiveToggle,
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
  /* Live Mode lives up here rather than in the composer, and the reason is
     not only that a third composer button clipped the placeholder at phone
     width. Live Mode is a session: it listens while the two of them work and
     raises coaching cards, for as long as it is on. Voice Mode is one
     message. Session-level controls are what this bar is for, and putting
     them in the same row as the composer's send button was what made the two
     modes look like variants of one thing. */
  liveListening: boolean;
  liveDisabled: boolean;
  onLiveToggle: () => void;
}) {
  const t = useMessages();
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

      {/* The title is the problem, so it is a quotation rather than interface
          copy and is isolated from the bidi algorithm for the same reason the
          worksheet card is. */}
      <span className="pp-topbar-title pp-transcript">{title}</span>

      <div className="pp-topbar-actions">
        <RegisterControl value={register} onChange={onRegisterChange} compact />

        {/* Live Mode. Named on the button, because the icon is arcs of sound
            and nothing in this product should rely on a parent guessing what
            a glyph means when the two guesses are "it is recording us" and
            "it is not". */}
        <button
          type="button"
          className={liveListening ? "pp-topbar-live pp-topbar-live-on" : "pp-topbar-live"}
          aria-label={liveListening ? t.live.stopShort : t.live.startShort}
          aria-pressed={liveListening}
          title={liveListening ? t.live.stopShort : t.live.startShort}
          disabled={liveDisabled}
          onClick={onLiveToggle}
        >
          <EarIcon size={16} />
        </button>

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
            aria-label={t.chat.share}
            title={t.chat.share}
            onClick={onShareOpen}
          >
            <ShareIcon size={16} />
            <span className="pp-topbar-share-label" aria-hidden="true">
              {t.chat.share}
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
