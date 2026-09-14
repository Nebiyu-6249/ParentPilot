"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import ThreadCard from "@/components/app/Cards";
import LiveBar from "@/components/app/LiveBar";
import RegisterControl from "@/components/RegisterControl";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import {
  AccountIcon,
  CameraIcon,
  CheckIcon,
  MicrophoneIcon,
  MicrophoneOffIcon,
  PanelIcon,
  SendIcon,
  TypeIcon,
} from "@/components/icons";
import { copy } from "@/lib/copy";
import { initialLiveState, type LiveState } from "@/lib/live/rules";
import { useLiveTranscript } from "@/lib/live/useLiveTranscript";
import type { RegisterName } from "@/lib/ai/schemas";
import type { Card, Turn } from "@/lib/thread";
import type { ClassifyResponse } from "@/app/api/live/classify/route";
import type { EndSessionResponse } from "@/app/api/session/[id]/end/route";

const RAIL_KEY = "pp_rail";

/* Below this the rail is a drawer over the thread rather than a column beside
   it, so it must start closed whatever the stored preference says. Matches the
   breakpoint in globals.css. */
const DRAWER_MAX = 860;

/** How often the rolling window is classified. Unchanged from the old screen. */
const CLASSIFY_INTERVAL_MS = 5000;

interface ThreadSummary {
  id: string;
  title: string;
  group: string;
}

/**
 * The chat surface.
 *
 * Sidebar left, thread centred, composer sticky at the bottom, because a
 * parent who has opened ChatGPT or Claude already knows where all three are.
 * The novelty budget is spent inside the cards, not on the shell.
 */
export default function AppShell({
  register: initialRegister,
  language,
  threads,
  signedIn,
}: {
  register: RegisterName;
  language: string;
  threads: ThreadSummary[];
  signedIn: boolean;
}) {
  const [railOpen, setRailOpen] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [register, setRegister] = useState<RegisterName>(initialRegister);
  const [text, setText] = useState("");

  // ---- Live Mode, folded into the thread -------------------------------
  const transcript = useLiveTranscript(language);
  /* The hook returns a fresh object every render, so every effect below
     depends on these stable callbacks rather than on `transcript`. Depending
     on the object tore down the five second classify interval on each render
     and it never fired. That bug is why this destructure exists. */
  const { listening, readWindow, start: startTranscript, stop: stopTranscript } = transcript;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [cardsSpent, setCardsSpent] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  /* The ref is what the classify interval reads; the state is what LiveBar
     renders from. Both are set at the same moment, because a ref alone would
     not re-render the bar and state alone would make the interval depend on
     a value that changes mid-session. */
  const [startedAt, setStartedAt] = useState(0);

  const liveStateRef = useRef<LiveState>(initialLiveState());
  const startedAtRef = useRef<number>(0);
  const parkedRef = useRef(false);
  const parkReasonRef = useRef<"time" | "escalation">("time");

  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // On a phone the rail covers the thread, so opening /app with it open
    // would hide the one thing the parent came for. The stored preference is
    // a desktop preference and only applies at desktop widths.
    if (window.innerWidth <= DRAWER_MAX) {
      setRailOpen(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem(RAIL_KEY);
      if (stored === "collapsed") setRailOpen(false);
    } catch {
      // Private browsing. The rail simply starts open.
    }
  }, []);

  function toggleRail(): void {
    setRailOpen((open) => {
      const next = !open;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? "open" : "collapsed");
      } catch {
        // Nothing to do.
      }
      return next;
    });
  }

  const scrollToEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  /** Appends a turn from the parent, then streams the assistant's reply. */
  const send = useCallback(
    async (init: RequestInit, parentBody: string | null) => {
      if (parentBody !== null) {
        setTurns((current) => [
          ...current,
          {
            id: `p-${Date.now()}`,
            role: "PARENT",
            body: parentBody,
            cards: [],
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setStatus(copy.status.reading);
      scrollToEnd();

      try {
        const response = await fetch("/api/thread/turn", init);
        if (!response.ok || !response.body) throw new Error(String(response.status));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let cards: Card[] = [];

        const consume = (line: string): void => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const event = JSON.parse(trimmed) as
            | { type: "status"; text: string }
            | { type: "cards"; cards: Card[] };
          if (event.type === "status") setStatus(event.text);
          else cards = event.cards;
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let at = buffer.indexOf("\n");
          while (at !== -1) {
            consume(buffer.slice(0, at));
            buffer = buffer.slice(at + 1);
            at = buffer.indexOf("\n");
          }
        }
        consume(buffer);

        setTurns((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "ASSISTANT",
            body: null,
            cards,
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch {
        setTurns((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "ASSISTANT",
            body: null,
            cards: [{ kind: "text", body: copy.errors.generic }],
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setStatus(null);
        scrollToEnd();
      }
    },
    [scrollToEnd],
  );

  /** Appends an assistant turn made locally, without a round trip. */
  const appendCards = useCallback(
    (cards: Card[]): void => {
      setTurns((current) => [
        ...current,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: "ASSISTANT",
          body: null,
          cards,
          createdAt: new Date().toISOString(),
        },
      ]);
      scrollToEnd();
    },
    [scrollToEnd],
  );

  /**
   * Ends the session and puts the summary in the thread.
   *
   * The old screen navigated to /recap/[id] here. In the thread the summary is
   * a card, and the recap page stays where it is for looking things up later.
   */
  const endLive = useCallback(
    async (wasParked: boolean): Promise<void> => {
      setEnding(true);
      stopTranscript();

      const minutes = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 60000),
      );

      if (!sessionId) {
        // No database, so nothing was recorded and there is nothing to total.
        appendCards([{ kind: "text", body: copy.live.endedUnrecorded }]);
        setEnding(false);
        return;
      }

      try {
        const response = await fetch(`/api/session/${sessionId}/end`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ parked: wasParked }),
        });
        const data = (await response.json()) as EndSessionResponse;

        const cards: Card[] = [];
        if (wasParked) {
          cards.push({
            kind: "park_it",
            reason: parkReasonRef.current,
            teacherNote: data.teacherNote,
          });
        }
        cards.push({
          kind: "live_summary",
          autonomyScore: data.autonomyScore,
          reading: data.reading,
          moveCounts: data.moveCounts,
          minutes,
          recap: data.recap,
          oneThingToTry: data.oneThingToTry,
          sessionId,
        });
        appendCards(cards);
      } catch {
        // The recap page recomputes from stored moves, so a failed end call
        // costs the summary card, not the session.
        appendCards([{ kind: "text", body: copy.live.endedUnrecorded }]);
      } finally {
        setSessionId(null);
        setEnding(false);
      }
    },
    [appendCards, sessionId, stopTranscript],
  );

  const startLive = useCallback(async (): Promise<void> => {
    setMicError(null);
    liveStateRef.current = initialLiveState();
    parkedRef.current = false;
    setCardsSpent(false);

    // The clock starts when listening starts, not when the parent taps: the
    // permission prompt can sit there for several seconds and those are not
    // seconds of homework.
    await startTranscript();
    const now = Date.now();
    startedAtRef.current = now;
    setStartedAt(now);

    try {
      const response = await fetch("/api/session", { method: "POST" });
      const data = (await response.json()) as { sessionId: string | null };
      setSessionId(data.sessionId);
    } catch {
      // Without a session id the coaching still works, it is just not recorded.
      setSessionId(null);
    }
  }, [startTranscript]);

  // The microphone is denied or missing. Say so in the thread rather than
  // leaving a button that looks like it did nothing.
  useEffect(() => {
    if (transcript.error === "denied") setMicError(copy.live.micDenied);
  }, [transcript.error]);

  /**
   * Classify the rolling window every five seconds.
   *
   * `readWindow()` is read here and goes straight into the request body. It is
   * never put in state, never attached to a turn, and never written anywhere.
   * The response carries a label and a coaching line, never the words back.
   */
  useEffect(() => {
    if (!listening) return;

    const timer = window.setInterval(async () => {
      if (parkedRef.current) return;

      const tOffset = Math.floor((Date.now() - startedAtRef.current) / 1000);

      try {
        const response = await fetch("/api/live/classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            window: readWindow(),
            tOffset,
            sessionId,
            state: liveStateRef.current,
          }),
        });
        if (!response.ok) return;

        const data = (await response.json()) as ClassifyResponse;
        liveStateRef.current = data.state;

        if (data.card) {
          appendCards([
            {
              kind: "live_card",
              text: data.card.text,
              triggerLabel: data.card.triggerLabel,
              tOffset: data.card.tOffset,
            },
          ]);
        }
        if (data.state.cardsShown >= 3) setCardsSpent(true);

        if (data.park) {
          parkedRef.current = true;
          parkReasonRef.current = data.park.reason;
          void endLive(true);
        }
      } catch {
        // A dropped classification is one missed window. The next one is five
        // seconds away, and interrupting the parent to say so would be worse.
      }
    }, CLASSIFY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [listening, readWindow, sessionId, appendCards, endLive]);

  function post(payload: Record<string, unknown>, parentBody: string | null): void {
    void send(
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, register }),
      },
      parentBody,
    );
  }

  function onFile(file: File): void {
    const form = new FormData();
    form.append("image", file);
    void send({ method: "POST", body: form }, copy.chat.photoTurn);
  }

  /** "Still stuck" advances the ladder. No model call: the rungs already exist. */
  function advance(problemId: string): void {
    const rung = lastRung(turns, problemId);
    post({ kind: "advance", problemId, rung }, copy.packet.stillStuck);
  }

  function solved(problemId: string): void {
    post({ kind: "solved", problemId }, copy.packet.answeredIt);
  }

  /**
   * Something the parent typed.
   *
   * Sends the problem and rung currently on screen so the reply is about this
   * page rather than about homework in general, and so the server can offer
   * the question the parent is already looking at when it declines to give
   * the answer.
   */
  function sendText(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    const problemId = lastProblemId(turns);
    post(
      {
        kind: "text",
        text: trimmed,
        problemId,
        rung: problemId === null ? 0 : lastRung(turns, problemId),
      },
      trimmed,
    );
  }

  function submitText(): void {
    const value = text.trim();
    if (!value) return;
    setText("");
    sendText(value);
  }

  const empty = turns.length === 0;

  return (
    <div className="pp-app" data-rail={railOpen ? "open" : "collapsed"}>
      <aside className="pp-rail" aria-label="Threads">
        <div style={{ padding: "12px 12px 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/" style={{ textDecoration: "none", flex: 1 }}>
            <Logo size={22} on="app" />
          </a>
          <button
            type="button"
            onClick={toggleRail}
            aria-label="Collapse sidebar"
            className="pp-composer-btn"
            style={{ width: 32, height: 32, borderRadius: "var(--r-control)" }}
          >
            <PanelIcon size={16} />
          </button>
        </div>

        <div style={{ padding: "8px 12px" }}>
          <button
            type="button"
            onClick={() => setTurns([])}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "10px 12px",
              borderRadius: "var(--r-control)",
              border: "1px solid var(--app-border-interactive)",
              background: "var(--app-card)",
              color: "var(--app-text)",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <CameraIcon size={17} />
            {copy.chat.newThread}
          </button>
        </div>

        <div className="pp-rail-scroll">
          {threads.length === 0 ? (
            <p style={{ padding: "12px 10px", fontSize: 13, color: "var(--app-text-dim)" }}>
              {signedIn ? copy.history.empty : copy.history.anonymous}
            </p>
          ) : (
            Object.entries(groupThreads(threads)).map(([group, items]) => (
              <div key={group}>
                <p className="pp-rail-group">{group}</p>
                {items.map((thread) => (
                  <a key={thread.id} href={`/app?thread=${thread.id}`} className="pp-rail-item">
                    {thread.title}
                  </a>
                ))}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--app-line)",
            padding: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <a href="/account" className="pp-rail-item" style={{ display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
            <AccountIcon size={17} />
            {signedIn ? copy.account.heading : copy.account.signIn}
          </a>
          <ThemeToggle />
        </div>
      </aside>

      {/* Tapping the thread behind an open drawer closes it. Rendered only
          when the drawer is actually over the thread. */}
      <button
        type="button"
        className="pp-scrim"
        aria-label="Close sidebar"
        tabIndex={railOpen ? 0 : -1}
        onClick={toggleRail}
      />

      <div className="pp-thread-wrap">
        <header className="pp-topbar">
          {!railOpen && (
            <button
              type="button"
              onClick={toggleRail}
              aria-label="Open sidebar"
              className="pp-composer-btn"
              style={{ width: 32, height: 32, borderRadius: "var(--r-control)" }}
            >
              <PanelIcon size={16} />
            </button>
          )}
          {/* The subject of the thread, which is the problem once there is
              one. Repeating the sidebar's "New worksheet" here said nothing
              the parent could not already see. */}
          <span className="pp-topbar-title">{title(turns)}</span>

          <RegisterControl value={register} onChange={setRegister} compact />
        </header>

        <div className="pp-thread" ref={threadRef}>
          <div className="pp-thread-inner">
            {empty && (
              <div className="pp-empty">
                <p style={{ fontSize: 19, marginBottom: 20, maxWidth: "26ch", marginInline: "auto" }}>
                  {copy.chat.emptyIntent}
                </p>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "15px 24px",
                    borderRadius: "var(--r-control)",
                    border: "1px solid var(--accent)",
                    background: "var(--accent)",
                    color: "#ffffff",
                    fontSize: 15.5,
                    fontWeight: 500,
                  }}
                >
                  <CameraIcon size={19} />
                  {copy.chat.emptyPhoto}
                </button>

                <button
                  type="button"
                  onClick={() => post({ kind: "demo" }, copy.chat.demoTurn)}
                  className="pp-card"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 26,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                    background: "var(--app-card)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <TypeIcon size={18} style={{ color: "var(--accent-ink)" }} />
                    <span style={{ fontSize: 14.5, fontWeight: 500 }}>{copy.chat.emptyDemo}</span>
                  </span>
                  <span style={{ display: "block", fontSize: 20, marginBottom: 6 }}>1/4 + 2/3 =</span>
                  <span style={{ display: "block", fontSize: 13.5, color: "var(--app-text-dim)" }}>
                    {copy.chat.emptyDemoWork}
                  </span>
                  <span
                    style={{ display: "block", fontSize: 13, color: "var(--app-text-dim)", marginTop: 6 }}
                  >
                    {copy.chat.emptyDemoNote}
                  </span>
                </button>

                <div style={{ marginTop: 26 }}>
                  {copy.chat.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="pp-chip"
                      onClick={() => sendText(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn) =>
              turn.role === "PARENT" ? (
                <div key={turn.id} className="pp-turn-parent">
                  {turn.body}
                </div>
              ) : (
                <div key={turn.id} className="pp-turn-assistant">
                  {turn.cards.map((card, index) => (
                    <ThreadCard
                      key={`${turn.id}-${index}`}
                      card={card}
                      onAdvance={advance}
                      onSolved={solved}
                    />
                  ))}
                </div>
              ),
            )}

            {status && (
              <div
                className="pp-turn-assistant"
                style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--app-text-dim)", fontSize: 14 }}
                role="status"
                aria-live="polite"
              >
                <CheckIcon size={16} />
                {status}
                <span aria-hidden="true">…</span>
              </div>
            )}
          </div>
        </div>

        <div className="pp-composer-wrap">
          {listening && (
            <LiveBar
              startedAt={startedAt}
              onStop={() => void endLive(false)}
              ending={ending}
              cardsSpent={cardsSpent}
            />
          )}

          {micError && !listening && <p className="pp-composer-note pp-mic-error">{micError}</p>}

          <div className="pp-composer">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFile(file);
                event.target.value = "";
              }}
            />

            {/* Photographing a worksheet is the primary input, so the camera
                is a first-class button rather than a paperclip afterthought. */}
            <button
              type="button"
              className="pp-composer-btn"
              aria-label={copy.chat.emptyPhoto}
              title={copy.chat.emptyPhoto}
              onClick={() => fileRef.current?.click()}
            >
              <CameraIcon size={19} />
            </button>

            <textarea
              ref={textRef}
              rows={1}
              value={text}
              placeholder={copy.chat.placeholder}
              onChange={(event) => {
                setText(event.target.value);
                const el = event.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitText();
                }
              }}
            />

            {/* One slot, two states. A disabled send button next to a
                microphone is 46px of a 358px composer spent on a control that
                does nothing, which on a phone is the difference between the
                placeholder fitting on one line and being clipped. */}
            {text.trim() ? (
              <button
                type="button"
                className="pp-composer-btn pp-composer-send"
                aria-label="Send"
                onClick={submitText}
              >
                <SendIcon size={18} />
              </button>
            ) : (
              /* The microphone is a toggle now, not a link to another screen.
                 Live Mode happens in this thread, so leaving it to go and
                 listen would mean leaving the worksheet behind. */
              <button
                type="button"
                className="pp-composer-btn"
                aria-pressed={listening}
                aria-label={listening ? copy.live.stopInThread : copy.live.startInThread}
                title={listening ? copy.live.stopInThread : copy.live.startInThread}
                disabled={ending}
                onClick={() => (listening ? void endLive(false) : void startLive())}
                style={
                  listening
                    ? { borderColor: "var(--accent)", color: "var(--accent-ink)" }
                    : undefined
                }
              >
                {listening ? <MicrophoneOffIcon size={19} /> : <MicrophoneIcon size={19} />}
              </button>
            )}
          </div>

          <p className="pp-composer-note">{copy.chat.note}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * What this thread is about: the printed problem, once one has been read.
 *
 * Empty until then rather than a placeholder, because an empty bar is honest
 * and "New worksheet" in two places at once is not information.
 */
function title(turns: Turn[]): string {
  for (const turn of turns) {
    for (const card of turn.cards) {
      if (card.kind === "worksheet") return card.printedText;
    }
  }
  return "";
}

/** The problem the thread is currently on, or null before there is one. */
function lastProblemId(turns: Turn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (!turn) continue;
    for (let j = turn.cards.length - 1; j >= 0; j -= 1) {
      const card = turn.cards[j];
      if (card && (card.kind === "ask" || card.kind === "worksheet")) return card.problemId;
    }
  }
  return null;
}

/** The rung currently showing for a problem, so "Still stuck" knows where it is. */
function lastRung(turns: Turn[], problemId: string): number {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (!turn) continue;
    for (let j = turn.cards.length - 1; j >= 0; j -= 1) {
      const card = turn.cards[j];
      if (card && card.kind === "ask" && card.problemId === problemId) return card.rung;
    }
  }
  return 0;
}

/** Today / This week / Earlier, the grouping every history sidebar uses. */
function groupThreads(threads: ThreadSummary[]): Record<string, ThreadSummary[]> {
  const out: Record<string, ThreadSummary[]> = {};
  for (const thread of threads) {
    const list = out[thread.group] ?? [];
    list.push(thread);
    out[thread.group] = list;
  }
  return out;
}
