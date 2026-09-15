# ParentPilot — session handover

You are picking up an existing project mid-build. The previous session's context is gone. Read this whole document, then get oriented from the repo before changing anything.

---

## What ParentPilot is

An AI homework copilot **for the parent, not the child**. A parent photographs a worksheet including their child's handwritten attempt. The app reads the working, verifies the arithmetic in code, identifies the misconception, and hands the parent the question to ask their child. The answer sits behind a press-and-hold.

**The constraint that defines the product: the AI speaks only to the adult. The child never touches the device and is never addressed by the model.** This is not a preference. It is the entire differentiation, it is asserted in the test suite, and it must not be relaxed for any reason.

It is built for a hackathon judged by the engineering team at Nerdy (the company behind Varsity Tutors), whose thesis is AI amplifying a human rather than replacing one.

### Why it works this way

- Parental homework help, as currently practised, correlates with *worse* math outcomes. The mechanism is helping style: controlling-supportive help predicts lower achievement, autonomy-supportive help predicts higher.
- Stanford's Tutor CoPilot RCT found AI coaching lifts the *least expert* helper most, by increasing probing questions and reducing generic praise.
- Bastani et al. found unguarded GPT-4 access left students 17% worse off than a no-AI control once it was removed. Routing the AI to the adult makes that failure mode structurally impossible.

---

## Get oriented first

Before writing code:

```bash
npm install
npm run typecheck
npm run check        # no network or key needed
npm run check:db     # needs DATABASE_URL
npm run check:ui
```

Then read, in this order:

1. `README.md`
2. `docs/design-plan.md` — the committed visual direction
3. `prompts/_standing-rules.md` — rules every model call inherits
4. `lib/thread.ts`, `lib/packet.ts`, `lib/email.ts`, `lib/doctor.ts`
5. `prisma/schema.prisma`

Report what you found before you start. If anything in this handover contradicts the repo, the repo is the truth and you should say so.

---

## Stack

Next.js 15 App Router, TypeScript strict, Tailwind v4. Prisma against PostgreSQL with pgvector on Neon. OpenAI behind `lib/ai/provider.ts`. `mathjs` exact fractions for arithmetic verification, never the model. Browser-native `SpeechRecognition` for Live Mode with chunked Whisper fallback. Resend for email over plain REST, no SDK. Deployed on Vercel.

Routes today, all under an `(site)` group except the product:
`/` `/account` `/capture` `/check` `/history` `/live` `/login` `/ops` `/ops/doctor` `/privacy` `/problem/[id]` `/recap/[sessionId]` `/settings` `/setup` `/shared/[token]` and `/app`.

Prompts live in `prompts/`: `_standing-rules.md`, `classify-move.md`, `extract-worksheet.md`, `generate-packet.md`, `session-recap.md`, `teacher-note.md`.

---

## Where the build actually stands

Working: schema and seed corpus (70 CCSS standards with embeddings, 20 hand-authored misconceptions), worksheet extraction, CAS verification with a Checked badge, misconception diagnosis, packet generation with register control, Method Match, hint ladder with press-and-hold answer, Live Mode with move classification and Park It, check-finished-work, teacher note, magic-link auth with HMAC-signed cookies, session history, teacher share links with expiry and revocation, audio primer via TTS, `/ops/doctor`, rate limits and a daily spend ceiling, light and dark mode.

Recently restructured to a **chat-first interface** at `/app` following Jakob's Law: sidebar with thread history, message thread where assistant turns render as rich cards rather than prose, composer with a camera button as the primary input and a microphone for Live Mode.

**Not yet built:** free-text conversational turns. Typing into the composer currently returns "Answering in your own words is not switched on yet." That is task 4 below.

---

## Invariants — do not break these

- No child account, no child login, no child-facing screen. Asserted.
- No transcript persisted anywhere. Live Mode audio never leaves the browser; only derived move labels and timestamps are stored. Asserted.
- The final answer is never stated in free-text prose. It exists only behind the press-and-hold card.
- Arithmetic is computed with `mathjs`, never taken from the model.
- Every model call goes through `lib/ai/provider.ts`, has a prompt file in `prompts/`, and increments the spend log. No inline prompt strings.
- `resolveAppUrl()` in `lib/app-url.ts` is the single source of the app URL. Keep its protocol allowlist.
- `AUTH_SECRET` must fail closed in production, never fall back to a development value.
- `Standard.embedding` is a pgvector column. `prisma migrate diff` will propose dropping it and its HNSW index on every migration. Never let that through. Declare it as `Unsupported("vector(1536)")` if it is not already.
- No em dashes anywhere, including model output.
- TypeScript strict. No `any`, no `@ts-ignore`.
- `npm run check`, `check:db` and `check:ui` must all keep passing.

---

## Task 1 — Surface the Resend error

Magic-link email is failing and the error is being discarded.

In `lib/email.ts`, `send()` captures Resend's real HTTP status and error body into `result.detail`. `sendMagicLink()` then logs only `result.reason`, which is always just `"unconfigured"` or `"failed"`. **`result.detail` is never logged or surfaced anywhere.**

- Include `detail` in the `console.warn`.
- Render email status on `/ops/doctor`. `emailStatus()` is already exported from `lib/email.ts` and nothing calls it. Show: configured true/false, the `RESEND_FROM` value, the key length and last four characters, and the detail of the most recent failed delivery. Persist that last failure alongside the existing failure log. Never print the key.
- Keep the user-facing message on `/login` generic.

Do this first and push it alone. It is one small change and it unblocks diagnosis.

## Task 2 — Empty state for a new thread

A new thread renders an empty void. It should show:

- One line of intent
- A large camera button
- The demo worksheet as a tappable card that runs the whole loop with no photo and no account, from `seed/demo-packet.json`
- Three tappable example follow-ups, written as a parent would actually type them: "she's getting frustrated", "she got it but I don't think she understands", "what should I not say"

## Task 3 — Thread top bar

The register control currently floats in the corner with no container, so the page has no anchor. Give the thread a real top bar: thread title on the left; register control and a Share button on the right; on a surface that separates it from the thread. Follow the convention of Claude and ChatGPT closely.

## Task 4 — Free-text conversational turns

This is the main remaining feature. The thread must be continuous: a parent works through problem one, then photographs problem two in the same thread with context carrying over.

Turn handling:

- **Photo** → extract, verify, retrieve standard, diagnose, generate packet → emit a `worksheet` card then an `ask` card
- **"Still stuck"** → advance one rung of the existing hint ladder, emit a new `ask`. No model call needed
- **"She answered it"** → short confirmation, offer one isomorph
- **Free text** ("she's getting frustrated", "she said 3/7 again", "what if she still doesn't see it") → a model call with thread context returning a coaching reply

Add `prompts/chat-turn.md`. It must hold the thesis under conversational pressure:

- Every reply addresses the **parent**. Never write a sentence for the parent to read aloud as an explanation; write the question the parent should ask.
- **Never state the final answer in prose.** A request for the answer returns the `answer` card.
- Never drift into being a general tutor or a general assistant. Out-of-scope requests get a short warm redirect.
- Three sentences or fewer unless the parent asks for depth.
- No em dashes.

Assertions required: a free-text turn requesting the answer does not contain the computed answer string; an unrelated question returns the redirect.

## Task 5 — Finish the round-four structure

- Fold Live Mode fully into the thread via the microphone toggle. Cards inline, recap emits a `live_summary` card.
- Build the marketing pages: `/how-it-works`, `/research`, `/for-teachers`. Proper server-rendered pages with real navigation and OG tags. `/research` is a credibility asset, give it a real page.
- Restyle the remaining routes to match the chat shell.

---

## Design

Use the `frontend-design` skill at `.claude/skills/frontend-design/SKILL.md`. If it is missing, read `docs/design-plan.md` and follow the same two-pass method: write a plan with named tokens, review it against known generic defaults, then code.

Brand: emerald `#00A878`, deep teal `#0B4F4A`, a four-pointed compass mark. Accent and identity, not dominant surface. Light and dark both required, system default with a manual toggle.

Follow mainstream AI-product convention on **interaction** — sidebar position, composer shape, where the primary action sits. Spend the distinctiveness budget on the **cards inside the thread**, which is where this product is unlike anything else.

Banned: harsh multi-stop gradients, neon, glassmorphism, radial orbs, confetti, mascots, invented testimonials, "it's not X, it's Y".

---

## How to work

- Stop after Task 1 and push it on its own.
- Stop after Task 3 and show me the thread with a real photo run through it.
- Do not start Task 5 until I have seen Task 4.
- Ask rather than invent. If a decision is not covered here, ask.
- Verify by looking, not only by asserting. Screenshot rendered pages in both modes at desktop and mobile. Several real bugs in this project survived a passing test suite and were only caught by looking at the screen.
