"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import ThreadCard from "@/components/app/Cards";
import ThreadBar from "@/components/app/ThreadBar";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import {
  AccountIcon,
  CameraIcon,
  CheckIcon,
  ChevronIcon,
  CopyIcon,
  MicrophoneIcon,
  MicrophoneOffIcon,
  PanelIcon,
  SendIcon,
  TypeIcon,
} from "@/components/icons";
import { useLiveSession } from "@/lib/live/useLiveSession";
import { copy } from "@/lib/copy";
import { Markdown } from "@/lib/markdown";
import type { RegisterName } from "@/lib/ai/schemas";
import {
  currentProblem,
  lastRung,
  threadTitle,
  threadTranscript,
  type Card,
  type Turn,
} from "@/lib/thread";

const RAIL_KEY = "pp_rail";

/* Below this the rail is a drawer over the thread rather than a column beside
   it, so it must start closed whatever the stored preference says. Matches the
   breakpoint in globals.css. */
const DRAWER_MAX = 860;

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
  threads,
  signedIn,
  language,
}: {
  register: RegisterName;
  threads: ThreadSummary[];
  signedIn: boolean;
  language: string;
}) {
  const [railOpen, setRailOpen] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [register, setRegister] = useState<RegisterName>(initialRegister);
  const [text, setText] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  /** The reply as it streams, before the turn is committed. */
  const [draft, setDraft] = useState("");
  /** Next moves for the turn just finished, written by the model. */
  const [chips, setChips] = useState<string[]>([]);
  /** False once the parent scrolls up, so the thread stops yanking them back. */
  const [pinned, setPinned] = useState(true);

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

  /**
   * Live Mode's turns.
   *
   * Appended the same way a reply is, so a coaching card raised at 8:14 sits
   * above the question asked at 8:15 and the whole evening reads in order.
   */
  const emitLive = useCallback((cards: Card[]) => {
    setTurns((current) => [
      ...current,
      { id: `l-${Date.now()}`, role: "ASSISTANT", body: null, cards, createdAt: new Date().toISOString() },
    ]);
    window.requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const live = useLiveSession(language, emitLive);

  /* Set while the thread scrolls itself, so its own scroll does not read as
     the parent scrolling away. Without this the thread un-pinned itself on
     the first streamed chunk, stopped following, and put up a jump control
     nobody had asked for. */
  const selfScrolling = useRef(false);

  const scrollToEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = threadRef.current;
      if (!el) return;
      selfScrolling.current = true;
      el.scrollTop = el.scrollHeight;
      window.setTimeout(() => {
        selfScrolling.current = false;
      }, 120);
    });
  }, []);

  /**
   * Follow the bottom, until the parent says otherwise.
   *
   * Scrolling up mid-reply is how someone re-reads the question they were
   * given, and a thread that drags them back down is unusable while text is
   * streaming into it. Within a screen of the bottom counts as still pinned.
   */
  const onThreadScroll = useCallback(() => {
    if (selfScrolling.current) return;
    const el = threadRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(fromBottom < 120);
  }, []);

  const follow = useCallback(() => {
    if (pinned) scrollToEnd();
  }, [pinned, scrollToEnd]);

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
      setDraft("");
      setChips([]);
      setPinned(true);
      scrollToEnd();

      try {
        const response = await fetch("/api/thread/turn", init);
        if (!response.ok || !response.body) throw new Error(String(response.status));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let cards: Card[] = [];
        let nextChips: string[] = [];

        const consume = (line: string): void => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const event = JSON.parse(trimmed) as
            | { type: "status"; text: string }
            | { type: "delta"; text: string }
            | { type: "cards"; cards: Card[]; chips?: string[] };

          if (event.type === "status") {
            setStatus(event.text);
            return;
          }
          if (event.type === "delta") {
            // The reply, as it is written. Cleared when the turn commits.
            setStatus(null);
            setDraft((current) => current + event.text);
            follow();
            return;
          }
          cards = event.cards;
          nextChips = event.chips ?? [];
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
        setChips(nextChips);
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
        setDraft("");
        scrollToEnd();
      }
    },
    [scrollToEnd, follow],
  );

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
    post({ kind: "advance", problemId, rung, printedText: printedTextFor(problemId) }, copy.packet.stillStuck);
  }

  function solved(problemId: string): void {
    post({ kind: "solved", problemId, printedText: printedTextFor(problemId) }, copy.packet.answeredIt);
  }

  /**
   * The problem's own text, for the turns that need it.
   *
   * A typed problem is not always stored, so the server cannot always look one
   * up by id. Sending the text back lets it rebuild the same packet instead of
   * falling through to the saved example, which would answer "Still stuck"
   * with a question about a different problem.
   */
  function printedTextFor(problemId: string): string | undefined {
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      for (const card of turns[i]?.cards ?? []) {
        if (card.kind === "worksheet" && card.problemId === problemId) return card.printedText;
      }
    }
    return undefined;
  }

  /**
   * A typed turn.
   *
   * Carries the conversation and which problem it is about, so a thread stays
   * continuous: photograph page two after working page one and the reply knows
   * what came before. The server reads every fact about the problem from its
   * own database, so what goes up is only what was said.
   */
  function submitText(value: string): void {
    const said = value.trim();
    if (!said) return;
    setText("");

    const problem = currentProblem(turns);
    post(
      {
        kind: "text",
        text: said,
        problemId: problem?.problemId ?? null,
        rung: problem ? lastRung(turns, problem.problemId) : 0,
        transcript: threadTranscript(turns),
      },
      said,
    );
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
        <ThreadBar
          title={threadTitle(turns)}
          problem={currentProblem(turns)}
          register={register}
          onRegisterChange={setRegister}
          railOpen={railOpen}
          onToggleRail={toggleRail}
          shareOpen={shareOpen}
          onShareOpen={() => setShareOpen(true)}
          onShareClose={() => setShareOpen(false)}
        />

        <div className="pp-thread" ref={threadRef} onScroll={onThreadScroll}>
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
                    border: "1px solid var(--accent-fill)",
                    background: "var(--accent-fill)",
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
                      onClick={() => submitText(suggestion)}
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
                <div key={turn.id} className="pp-turn-assistant" data-turn="assistant">
                  {turn.cards.map((card, index) => (
                    <ThreadCard
                      key={`${turn.id}-${index}`}
                      card={card}
                      onAdvance={advance}
                      onSolved={solved}
                    />
                  ))}
                  <TurnCopy turn={turn} />
                </div>
              ),
            )}

            {/* The reply as it is written. Committed as a turn when the
                structured half validates, so what is on screen here is a
                preview and never the record. */}
            {draft && (
              <div className="pp-turn-assistant pp-turn-draft" aria-live="polite">
                <div className="pp-turn-text" style={{ fontSize: 15, lineHeight: 1.6, maxWidth: "68ch" }}>
                  <Markdown source={draft} />
                  <span className="pp-caret" aria-hidden="true" />
                </div>
              </div>
            )}

            {status && !draft && (
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

            {/* Next moves, written for the turn above. Tapping one is the same
                as typing it, which is why they read like something a parent
                would have typed. */}
            {chips.length > 0 && !status && !draft && (
              <div className="pp-next" aria-label={copy.chat.chipsLabel}>
                {chips.map((chip) => (
                  <button key={chip} type="button" className="pp-chip" onClick={() => submitText(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!pinned && (
          <button
            type="button"
            className="pp-jump"
            onClick={() => {
              setPinned(true);
              scrollToEnd();
            }}
          >
            <ChevronIcon direction="down" size={15} />
            {copy.chat.jumpToLatest}
          </button>
        )}

        <div className="pp-composer-wrap">
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
                  submitText(text);
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
                onClick={() => submitText(text)}
              >
                <SendIcon size={18} />
              </button>
            ) : (
              /* Live Mode, in place. It used to navigate to its own screen,
                 which meant leaving the thread mid-session and coming back to
                 a recap that had no relationship to it. */
              <button
                type="button"
                className={live.listening ? "pp-composer-btn pp-composer-live" : "pp-composer-btn"}
                aria-label={live.listening ? copy.live.stopShort : copy.live.startShort}
                aria-pressed={live.listening}
                title={live.listening ? copy.live.stopShort : copy.live.startShort}
                onClick={() => void (live.listening ? live.stop() : live.start())}
              >
                {live.listening ? <MicrophoneOffIcon size={19} /> : <MicrophoneIcon size={19} />}
              </button>
            )}
          </div>

          {live.listening ? (
            <p className="pp-composer-note pp-listening" role="status" aria-live="polite">
              <span className="pp-listening-dot" aria-hidden="true" />
              {copy.live.listeningInThread} {formatClock(live.elapsed)}
            </p>
          ) : live.error === "denied" ? (
            <p className="pp-composer-note" role="status">
              {copy.live.micDenied}
            </p>
          ) : (
            <p className="pp-composer-note">{copy.chat.note}</p>
          )}
        </div>
      </div>
    </div>
  );
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

/** mm:ss, for the listening indicator. */
function formatClock(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Copy an assistant turn.
 *
 * Appears on hover and on focus, so it is reachable by keyboard rather than
 * only by pointer. It copies the words, not the cards: a parent copying a
 * worked example wants to paste it into a message, and a JSON blob is not
 * that.
 */
function TurnCopy({ turn }: { turn: Turn }) {
  const [copied, setCopied] = useState(false);
  const text = plainText(turn);
  if (!text) return null;

  return (
    <div className="pp-turn-tools">
      <button
        type="button"
        className="pp-turn-copy"
        aria-label={copy.chat.copyTurn}
        onClick={() => {
          void navigator.clipboard
            .writeText(text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        <CopyIcon size={14} />
        {copied ? copy.chat.copiedTurn : copy.chat.copyTurn}
      </button>
    </div>
  );
}

/** An assistant turn as something a parent could paste into a message. */
function plainText(turn: Turn): string {
  const parts: string[] = [];

  for (const card of turn.cards) {
    switch (card.kind) {
      case "text":
        parts.push(card.body);
        break;
      case "ask":
        parts.push(card.question);
        break;
      case "explainer":
        parts.push(`${card.term}: ${card.short}`);
        if (card.more) parts.push(card.more);
        break;
      case "worked_example":
        parts.push(card.problem);
        parts.push(
          card.steps.map((s, i) => `${i + 1}. ${s.move}${s.working ? ` ${s.working}` : ""}`).join("\n"),
        );
        if (card.point) parts.push(card.point);
        break;
      case "strategy":
        parts.push(card.moves.map((m) => `${m.title}: ${m.body}`).join("\n"));
        if (card.avoid) parts.push(card.avoid);
        break;
      // The answer is not copyable from here. It lives behind the press and
      // hold, and a copy control that lifted it out would be a way around it.
      default:
        break;
    }
  }

  return parts.join("\n\n").trim();
}
