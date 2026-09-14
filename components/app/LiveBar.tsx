"use client";

import { useEffect, useState } from "react";

import CompassDraw from "@/components/CompassDraw";
import { MicrophoneOffIcon } from "@/components/icons";
import { copy } from "@/lib/copy";

/**
 * The listening state, sitting above the composer.
 *
 * On the old /live screen this was the whole page: a breathing mark, a timer,
 * and nothing else. In the thread it shrinks to a bar, because the thread
 * itself is now where the coaching lands and a full-screen takeover would
 * hide the worksheet the parent is working from.
 *
 * The timer lives here rather than in AppShell on purpose. It ticks once a
 * second, and in the shell that would re-render every card in the thread once
 * a second for the whole session.
 */
export default function LiveBar({
  startedAt,
  onStop,
  ending,
  cardsSpent,
}: {
  startedAt: number;
  onStop: () => void;
  ending: boolean;
  cardsSpent: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = (): void => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="pp-live-bar" role="status" aria-live="off">
      <CompassDraw mode="breathe" size={26} />

      <span className="pp-live-time">
        {minutes}:{seconds}
      </span>

      <span className="pp-live-label">
        {cardsSpent ? copy.live.cardsSpent : copy.live.listening}
      </span>

      <button type="button" onClick={onStop} disabled={ending} className="pp-live-stop">
        <MicrophoneOffIcon size={16} />
        {ending ? copy.common.loading : copy.live.stop}
      </button>
    </div>
  );
}
