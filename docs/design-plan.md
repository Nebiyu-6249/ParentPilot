# ParentPilot, design plan for round two

Written before any code, per the two-pass process: draft, review against the
brief hunting for generic defaults, revise. The review pass and what it changed
is recorded at the bottom, because the changes it forced are the useful part.

---

## 1. The idea in one line

**A teal desk at eight in the evening, with paper on it and a green pen.**

The surface strategy inverts: teal is the desk and the frame, paper is reserved
for content, and emerald is the pen. Nothing on the page is a "card" in the
generic sense. Things are either the desk, a sheet of paper on the desk, or a
mark made on that paper.

---

## 2. Tokens

Raw brand values are unchanged. A semantic layer sits on top of them, and that
layer is what components use, so light and dark are two value sets rather than
two code paths.

### Raw, unchanged

```
--paper   #F5F1E8    --ink    #14201E    --emerald #00A878
--teal    #0B4F4A    --rule   #D9D2C4    --muted   #6E665A    --alert #A8422F
```

### Semantic, light

| Token | Value | Role |
|---|---|---|
| `--surface-frame` | `#0B4F4A` | the desk: hero, nav band |
| `--surface-frame-deep` | `#073A36` | header and footer, darkest |
| `--surface-frame-raised` | `#0E5F59` | hover and inset on the desk |
| `--surface-sheet` | `#F5F1E8` | paper: all real content |
| `--surface-sheet-sunk` | `#EDE7D9` | a second paper weight, ruled areas |
| `--text-on-frame` | `#EDE7DA` | warm off-white |
| `--text-on-frame-muted` | `#A9BDB8` | 4.78 on frame |
| `--text-on-sheet` | `#14201E` | 14.84 on paper |
| `--text-on-sheet-muted` | `#6E665A` | 5.02 on paper |
| `--annotation` | `#00704F` | **the pen, on paper** |
| `--annotation-on-frame` | `#00A878` | the pen, on the desk |
| `--pencil` | `#5A5247` | the child's handwriting |
| `--rule-on-sheet` | `#D9D2C4` | hairline on paper |
| `--rule-on-frame` | `#1A6B64` | hairline on the desk |
| `--alert-fg` | `#A8422F` | Park It, errors |

### Semantic, dark (designed, not computed)

| Token | Value | Note |
|---|---|---|
| `--surface-frame` | `#0A1614` | deep green-black, brief's value |
| `--surface-frame-deep` | `#060E0D` | |
| `--surface-frame-raised` | `#102420` | |
| `--surface-sheet` | `#132A25` | paper becomes a *lit* sheet, not a cream slab |
| `--surface-sheet-sunk` | `#0F221E` | |
| `--text-on-sheet` / `--text-on-frame` | `#EDE7DA` | warm off-white, brief's value |
| `--text-on-sheet-muted` | `#9FB3AE` | 6.88 on sheet |
| `--annotation` | `#00A878` | **emerald holds in dark**, 4.96 on sheet |
| `--pencil` | `#B9A98F` | 6.59 on sheet |
| `--rule-on-sheet` | `#2A443D` | **lighter than the surface**, not darker |
| `--rule-on-frame` | `#24403A` | |
| `--alert-fg` | `#E08770` | lifted; `#A8422F` is 2.52 on dark and fails |

### The one deviation, and why

The brief says emerald becomes the annotation colour. Measured, `#00A878` on
`#F5F1E8` is **2.71**, which fails even the 3:1 non-text threshold, so circling
a wrong digit in brand emerald would have been an inaccessible mark carrying
real meaning.

So `--annotation` is **`#00704F`** on paper (5.43, AA for text and marks) and
brand `#00A878` on the teal desk (3.08, passes non-text) and in dark mode
(4.96, AA). The brand emerald is untouched in the logo. This is not a
compromise on the idea: a teacher's green pen on paper genuinely is darker than
a screen emerald. It is the ink weight of the same colour.

**Rule that falls out of this:** emerald is never text on the teal desk, only a
mark. Emerald text on teal is 3.08 and would fail.

### Contrast, measured not assumed

Every pair the design actually uses, computed with the WCAG formula:

```
LIGHT  off-white on teal desk      7.64 AAA    ink on paper           14.84 AAA
       muted on teal desk          4.78 AA     muted ink on paper      5.02 AA
       pen on paper                5.43 AA     pencil on paper         6.82 AA
       pen-mark on teal desk       3.08 non-text ok
DARK   off-white on dark frame    14.98 AAA    off-white on sheet     12.30 AAA
       muted on sheet              6.88 AA     emerald on sheet        4.96 AA
       pencil on sheet             6.59 AA     alert lifted            5.68 AA
```

---

## 3. Type

- **Display: Fraunces**, 600. Kept, and used in **two places only**: the hero
  headline and the wordmark. Nowhere else.
- **Body and UI: Public Sans**, 400/500/600. Replaces IBM Plex Sans.
- **Section headings are Public Sans 600, not serif.** This is the change that
  stops the page reading as a cream literary essay. A serif heading on every
  section is one of the two clusters the brief names.

Scale, named:

```
--type-display  clamp(2.75rem, 6.5vw, 4.25rem)   hero only, genuinely large
--type-h1       clamp(1.75rem, 3.5vw, 2.25rem)
--type-h2       1.375rem
--type-h3       1.0625rem
--type-body     17px      (floor, unchanged)
--type-small    0.9375rem
--type-micro    0.8125rem
```

---

## 4. Layout

- Page capped at **1200px**, not 720px.
- **Hero is asymmetric**: `minmax(0,5fr) / minmax(0,7fr)` on desktop. Words
  left, artifact right and larger, because the artifact is the pitch.
- Mobile stacks, and mobile is the primary case. Artifact first below the
  headline, actions below that, thumb-reachable.
- Vertical rhythm by surface, not by hairline alone:
  `dark header → teal hero → paper content → dark footer`.
  A page reads as a sheet of paper lying on a desk.

---

## 5. The hero artifact

The most characteristic object in this product's world, rendered live from
`seed/demo-packet.json`, not described.

**Left, the worksheet.** A paper sheet on the teal desk, rotated `-1.1deg`,
with a ruled margin line. Printed `1/4 + 2/3 =` in the body face, then the
child's working **hand-drawn as SVG paths** in pencil grey:
`1 + 2 = 3`, `4 + 3 = 7`, `so 3/7`.

Hand-drawn rather than a handwriting webfont on purpose. Caveat and Kalam are
instantly recognisable and would read as a template choice; the icons are
custom for the same reason, and three short lines of arithmetic is a tractable
amount of path work.

**The mark.** An emerald ring around the `7` in `3/7`, drawn as an open
elliptical stroke with a slight overshoot where a pen would overlap its own
start, plus a short caret beneath. This is the one place the annotation idea
becomes literal, and it is the thing that makes the page legible in two seconds.

**Right, the coaching card.** Also paper, square, unrotated, sitting flat.
Emerald rule at the top edge. Carries the misconception `plainName` and the
`repairQuestion`, both straight from the fixture.

**Explicitly not:** no browser chrome, no laptop or phone frame, no drop
shadow pretending to be a screenshot, no before/after slider. The paper is the
thing itself, not a picture of a screen.

---

## 6. Below the hero, ruthlessly short

In order, on paper:

1. Two actions: *Try it on this worksheet* / *Set up in four steps*.
2. Three lines on how it works, each with a custom icon. **Lines in a column,
   not three cards in a row** — a 3-up icon-card grid is the default this brief
   is trying to escape.
   - `camera` Photograph the worksheet, their working and all.
   - `type` Check what we read. Fix a misread line in one tap.
   - `lock` Five questions to ask. The answer stays behind a press and hold.
3. One privacy line, the audio promise.
4. One research citation, Maloney 2015, visible. The other three inside a
   `<details>`, collapsed.

Gone: the four-citation list, the five-step explainer, the multi-paragraph
"what it will not do".

---

## 7. Icons

`components/icons.tsx`. 24px grid, 1.5px stroke, `stroke-linecap="round"`,
`stroke-linejoin="miter"` to echo the compass mark's mitred points, `rx` never
set. Geometric, built from the same four-point diamond language as the logo.
Typed, each taking `size` and `className`, `currentColor` throughout.

Set: camera, upload, microphone, microphone-off, type, copy, share, download,
check, alert, lock, unlock, play, pause, chevron, close, settings, history,
send, language, sun, moon, account.

Rule: an icon labels an action or a category. Never decoration, never inside
body prose.

---

## 8. Dark mode mechanics

`data-theme` on `<html>`, set by a tiny inline script in `<head>` before first
paint so there is no flash. Order: stored choice, then `prefers-color-scheme`,
then light. Toggle uses the sun and moon icons, persists to `localStorage`
under `pp_theme`. `prefers-reduced-motion: reduce` disables the intro, the
breathing mark and every transition.

---

## Review pass: what the draft got wrong

Ran the draft against the brief's ban list and the two additions, hunting for
defaults that had crept in.

| Caught | Changed to |
|---|---|
| Emerald annotation on paper measured **2.71**, inaccessible for a mark that carries meaning | Split the token: `#00704F` on paper, `#00A878` on desk and in dark |
| Three how-it-works items had become **three cards in a row**, a bento default | A single column of three lines with an icon each |
| Draft put a serif `<h2>` on every section, the exact cluster the brief names | Fraunces restricted to hero headline and wordmark only |
| Hero artifact was drifting toward a **screenshot in a device frame** | Paper objects directly on the desk, no chrome, no frame |
| Considered a handwriting webfont for the child's working | Hand-drawn SVG paths, consistent with custom icons |
| Draft had an all-caps tracked eyebrow over the hero headline | Removed, banned addition |
| Draft accented "not to your child" in emerald inside the headline | Removed, banned addition. Headline is one weight, one colour |
| Dark mode was going to reuse `--alert` unchanged at **2.52** | Lifted to `#E08770`, 5.68 |
| Dark rules were going darker than the surface | Lighter than the surface, per brief |

---

# Round three, Part B: dark mode redone

## What was wrong

The first dark mode made the sheet `#132A25` and the desk `#0A1614`: two dark
greens close in value, so paper stopped reading as paper. The child's working
in cream on dark green read as chalk on a blackboard, which inverts the
meaning of the hero. A blackboard is the teacher's authoritative surface; that
worksheet is the child's fallible attempt.

## The answer

**The room is dim. There is a lamp on the desk. The paper stays paper.**

Dark mode keeps the unlit frame and lights the sheet. It is not an inversion
and not a darkened copy; it is the same scene at night.

| Token | Light | Dark | Note |
|---|---|---|---|
| `--surface-frame` | `#0B4F4A` | `#0A1614` | the desk, teal by day and unlit at night |
| `--surface-sheet` | `#F5F1E8` | `#DED8C9` | paper, dimmed to 78% of its daytime luminance |
| `--text-on-sheet` | `#14201E` | `#14201E` | ink on paper, identical in both |
| `--annotation` | `#006646` | `#006646` | one pen colour, both modes |
| `--pencil` | `#5A5247` | `#5A5247` | graphite, both modes |
| `--alert-fg` | `#A8422F` | `#943826` | lifted only where the paper is dimmer |
| `--text-on-frame` | `#EDE7DA` | `#EDE7DA` | warm off-white on the desk |

Because the sheet stays paper, ink, pencil and pen are now the **same values in
both modes**. Half the dark palette stops existing, which is the point: a
designed variant needs fewer overrides than a darkened copy, not more.

## Structural change this forces

The body was `--surface-sheet`, so the whole viewport was paper and the desk
only appeared inside the landing hero. With a lit sheet that would make dark
mode a mostly-bright page, which is not "a lamp on the desk", it is light mode
with a dark header.

So the body becomes the desk in both modes, and content screens render an
explicit sheet on it. `Page` gains a `surface` prop: `sheet` by default, and
`desk` for Live Mode, which is the one screen that is not a document and
should not be a lit rectangle at eight in the evening.

## Deviation from the brief, measured

The brief specifies `--annotation: #00704F` unchanged in both modes. On the
dimmed paper that measures **4.31**, which fails AA for the 13px "What went
wrong" label that uses it. `#006646` is 6.23 on daytime paper and 4.94 on
dimmed paper, and a paper-coloured label on top of it clears 4.5 both ways.

It is still one value across both modes, which was the actual intent, and the
shift is small enough to be invisible side by side. `--alert-fg` needed the
same treatment but only on the dimmed sheet, so it keeps `#A8422F` by day.

## Review pass

| Caught | Changed to |
|---|---|
| Body as sheet would make dark mode a bright page | Body is the desk; content sits on an explicit sheet |
| Live Mode would render a lit rectangle at night | `Page surface="desk"` for that one screen |
| `--annotation` at `#00704F` fails on dimmed paper | One value, `#006646`, passing on both |
| Half the dark block was redundant once the sheet is paper | Overrides reduced to the frame, the dimmed sheet, and alert |

---

# Round three, Part D: the UX inversion

## What was wrong

The problem screen opened with a seven-line primer, then a paragraph on the
error, then a diagram, then Method Match as two five-step columns, and only
then the questions. A parent mid-session had to read an essay before reaching
the one thing they needed. If the product feels like homework itself, they stop
opening it.

## The screen is one question

Above the fold, four things and nothing else:

1. the problem, small
2. the child's working, small
3. **the question to ask right now, as the largest text on the screen**
4. one primary button

Everything else is a closed disclosure.

## Resolving "a single button"

The brief lists `"She answered it" / "Still stuck"` as a single button, and also
says a screen with more than one primary action has none. Both outcomes need a
home, so only one of them is primary:

- **Still stuck** is the primary, filled and full width. It advances the ladder
  one rung, replacing the large line. It is the path that continues.
- **She answered it** is quiet and secondary. It is the end of the task, and a
  parent whose child just answered does not need a button to celebrate it; they
  need the session recorded and their phone put down.

## Disclosures, ordered by when a parent reaches for them

1. Why she got it wrong
2. Show me both methods
3. What is this teaching?
4. What to say, and what to skip
5. Just tell me the answer

The answer is last on purpose. It is the escape hatch and it should be the
furthest thing from the thumb.

## Two things that moved

**The primer** defaults to its first two sentences with the rest behind an
expand, and sits at position three. It is the most valuable content for a
parent who wants to understand and the wrongest thing to open with at 8pm.

**The isomorphs** leave the stuck path entirely. Their own copy says "use these
once the first one has clicked", so they belong in the solved state, not in a
sixth disclosure competing for attention while the child is still stuck.

## The register control

Sits immediately below the fold, quiet. It is not primary, but a parent who
cannot parse the large question needs "Simpler" within one thumb-reach, not
buried in a disclosure.

## How "above the fold" is verified

Not by eye. The check measures, in a real browser at 390x844 and 360x640, that
the primary button's bottom edge is above the viewport fold with the page
unscrolled. A design rule that is not measured is a preference.

## Review pass

| Caught | Changed to |
|---|---|
| Two equally weighted buttons would have meant no primary action | Still stuck is primary; She answered it is quiet |
| Isomorphs were heading for a sixth disclosure on the stuck path | Moved to the solved state, where their own copy says they belong |
| Disclosure order put the answer in the middle, within easy reach | Answer last, furthest from the thumb |
| "Above the fold" was going to be an assertion by eye | Measured in a browser at two phone sizes |

---

# Round three, Part C: restrictions lifted, with judgement

Four things are now allowed. Each is taken only where it does work.

## 1. A small radius on interactive elements

`* { border-radius: 0 !important }` is gone. It was a sledgehammer: it applied
to every element including ones that were never going to be round, and because
`outline` follows `border-radius`, it forced hard-cornered focus rings on
controls the browser would otherwise have drawn correctly.

Replaced with **one token, `--radius-control: 3px`, applied to interactive
elements only**. Buttons, inputs, selects and the segmented control get 3px.

**Surfaces stay square.** The sheet, the worksheet, the coaching card and every
diagram keep zero radius, because they are paper, and paper does not have
rounded corners. The radius is a signal that something can be pressed, which is
worth more than the radius being decorative everywhere.

The Tailwind radius scale caps at 4px, so nothing in the system can reach for a
pill or a blob. Asserted.

## 2. Soft elevation, on one thing

The Live Mode card is the only element in the product that genuinely floats: it
slides up over a live session and is dismissed. It gets a soft shadow.

The sheet keeps its **hard flat offset**, because it is paper lying on a desk
rather than a card hovering above one. Those are different physical claims and
they should not use the same shadow.

## 3. The third voice: an action colour

This one is a real need, not an indulgence, and it fixes a regression I
introduced in Part D.

The round-two direction made emerald the annotation colour, the marks a teacher
makes on a page, and said explicitly: not a button fill everywhere. Part D then
filled the primary button with `var(--annotation)`. Emerald ended up meaning
both "this is the error" and "press this", which are unrelated ideas wearing
the same colour.

So `--action` is split out and **emerald returns to being only the pen**.

`--action` is the deep brand teal rather than a new hue. The palette already
has a third voice; inventing a fourth to sit beside teal, emerald and the
earthy alert would be decoration. Filled teal with a paper label measures 8.35
on daytime paper and 6.62 on the dimmed night sheet.

| Colour | Means |
|---|---|
| emerald `--annotation` | a mark on the page: the ring, the error label, Checked |
| teal `--action` | press this |
| `--alert-fg` | stop, or unverified |

## 4. Icons where they aid scanning

The five disclosures carry a category icon on the left and the chevron on the
right. A parent scanning for "the answer" or "why she got it wrong" finds the
shape before the word. Nothing else gains an icon: an icon still labels an
action or a category, never decorates prose.

## Review pass

| Caught | Changed to |
|---|---|
| Allowing radius everywhere would round the paper | 3px on interactive elements only; surfaces stay square |
| Elevation was going onto the sheet as well | Soft shadow on the Live Mode card only; the sheet keeps its hard offset |
| A genuinely new fourth hue was tempting for `--action` | Deep teal, already in the brand; a fourth hue would be decoration |
| The relaxed ban list would have quietly permitted skeleton loaders | The status line stays; it is a product decision from the original brief, not a ban-list artefact |

---

# Round four, Part 1: chat-first, and a website around it

## The move

Two surfaces with opposite design rules, and that opposition is the plan.

**The shell is deliberately unoriginal.** Sidebar left, thread centred,
composer sticky at the bottom, history grouped by recency. A parent who has
opened ChatGPT or Claude already knows where everything is, and every gram of
novelty spent on the shell is a gram of learning charged to someone at eight in
the evening with a frustrated child next to them.

**The cards are where the product is unlike anything else**, so that is where
the whole distinctiveness budget goes: the worksheet with its pencil working,
the single large question, the press-and-hold answer, the method comparison.

## Tokens: a new layer, not a replacement

The existing `--surface-frame` / `--surface-sheet` layer stays exactly as it
is, because `/problem/[id]`, `/shared`, `/privacy` and the rest still use it
and are restyled in steps 6 and 7. `/app` gets its own layer beside it.

Teal and emerald stop being surfaces and become accent and identity only, as
the brief asks.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--app-bg` | `#FFFFFF` | `#191918` | the thread column |
| `--app-rail` | `#F7F6F3` | `#141413` | the sidebar |
| `--app-card` | `#FFFFFF` | `#212120` | a card in the thread |
| `--app-bubble` | `#F2F1ED` | `#2B2B28` | the parent's own turn |
| `--app-line` | `#E6E4DE` | `#34332E` | dividers and card edges |
| `--app-text` | `#1A1A18` | `#EDEDE9` | body |
| `--app-text-dim` | `#6B6862` | `#A8A49B` | secondary |
| `--accent` | `#00A878` | `#00A878` | the brand, as accent |
| `--accent-ink` | `#00664A` | `#3FD0A2` | accent as text, where it must pass AA |

Contrast is computed from these in `npm run check`, same as the existing layer.

## Type

**Inter for the interface.** It was banned in round two and un-banned here, and
un-banning it is the right call for this round specifically: it is the typeface
of the products this shell is imitating, and imitation is the objective.

**Fraunces stays for the wordmark and for the one large question in the `ask`
card.** That is the whole of its remaining job. The mark keeps the brand
present without the brand taking over the surface.

## Radius and elevation, at mainstream values

Round three capped radius at 4px. That cap is lifted here, because a 4px chat
composer reads as a text input on a form rather than as a composer.

```
--r-control  8px     buttons, segmented control
--r-card    12px     cards in the thread
--r-bubble  18px     the parent's turn
--r-composer 24px    the composer shell
```

Cards get one soft shadow, not three. The composer gets a slightly stronger one
because it floats over scrolling content.

## The empty state does the selling

A blank composer is the single worst thing to show a parent who has just
arrived, so the empty thread carries one line of intent, a large camera button,
**the demo worksheet as a tappable card**, and three follow-ups written the way
a parent actually types: "she's getting frustrated", "she got it but I don't
think she understands", "what should I not say".

The demo card matters most: it runs the entire loop with no photo, no account
and no model call, so a parent can see what the product does before deciding
whether to trust it with a photograph of their child's work.

## Review pass

| Caught | Changed to |
|---|---|
| Replacing the token layer would have broken every unrestyled route at once | A second layer beside the first; the old routes restyle in steps 6 and 7 |
| Teal as the app background would have kept the old shell wearing new clothes | Neutral chrome; teal and emerald are accent and identity only |
| Fraunces everywhere would have fought the convention the shell is imitating | Fraunces on the wordmark and the one large question, nowhere else |
| The composer was drifting toward a paperclip menu | The camera is a first-class button; photographing a worksheet is the primary input |
| Cards were all going to be open, which is the wall of panels this replaces | Collapsed by default except `ask`, which is always open |

## What the first render of the shell got wrong

The plan above survived contact with a browser; the execution did not. Six
defects, all found by screenshotting the thing rather than reading the code.

| Found on screen | Cause | Fix |
|---|---|---|
| On a phone the sidebar opened over the thread | `railOpen` defaulted to `true`, and below 860px the rail is a drawer | The stored preference is a desktop preference; the drawer starts closed, and a scrim dismisses it |
| The whole surface squeezed into the left quarter of a phone | `.pp-app[data-rail="collapsed"]` is specificity 0,2,0 and beat the media query's bare `.pp-app`, leaving the thread in the 0-width track | The media query names all three rail states |
| A degraded packet rendered exactly like a real reading | `cardsForPacket` dropped `bundle.notice` | A `notice` card, first in the turn, never collapsed |
| Two tracked-out all-caps eyebrows, the round-two tell | `textTransform: uppercase` in the register control and the `ask` card | Sentence case in both; asserted so neither comes back |
| The wordmark was near-invisible on the dark rail | `Logo` used `--brand-teal`, a fixed brand constant, on a surface whose ground changes with the theme | `Logo` takes a surface; on `app` the mark uses `--app-text` and emerald carries the brand |
| The composer placeholder wrapped and the second line was clipped | 196px of text in a 194px box | The disabled send button, 46px of dead weight, now shares one slot with the microphone |

Two of these are the kind that only a measurement catches, so both are now
measured rather than described: `check:ui` asserts the thread fills a 390px
phone and that the placeholder fits on one line in whatever font actually
rendered.

## Contrast, on a second surface

The `--app-*` layer arrived with no contrast assertions at all, which is how
the paper surface got to 1.10:1 in round three. Twelve pairs are now checked in
both themes. One was a real failure: `--app-line` at 1.2:1 was drawing the
composer and the outline buttons, and WCAG 1.4.11 wants 3:1 for a control
identified by its border. `--app-border-interactive` splits the hairline from
the boundary, the same split the paper surface already makes.

## Step four: what a typed message gets back

The composer stops swallowing what a parent types. A free-text turn goes to
`prompts/chat-turn.md` and comes back as one `coach` card: two to four
sentences of reply, optionally one sentence to say out loud, optionally one
clause naming what to listen for.

`sayThis` gets the display face, the same treatment as the `ask` card's
question, one step smaller. Both are words to say to a child at a kitchen
table; one idea should look like one idea wherever it turns up. The reply
itself is the only prose on the surface, because a reply to a sentence is a
sentence.

## Two layers between a typed question and the answer

The brief's rule is that the answer lives behind the press and hold and
nowhere else. A chat composer is the obvious place for that to fail, so it is
held by two independent mechanisms.

**The first is an absence.** `chatTurn` is the only task in `lib/ai/provider.ts`
that is not given the verified answer. Every other one that knows it is told
it; this one gets the problem, the child's working, the misconception and the
rung on screen, and nothing else. There is no answer in the context to repeat.
`scripts/check.ts` reads the call and fails if one appears.

**The second is a scan.** `lib/answer-guard.ts` checks the reply against the
verified answer in case the model worked it out for itself. It knows the
answer as digits, spaced around a slash, and spoken: `11/12`, `11 / 12`,
`11 over 12`, `eleven twelfths`. It does not know every equivalent form or
every paraphrase, which is why it is the backstop and not the guarantee. Its
bias is toward false positives: redirecting a parent who did not need it costs
one tap, and the other error costs them the thing they came here to avoid.

Both containments land in the same place. `answer_request` and a fired guard
produce the identical card, because from where the parent sits, being told the
answer is behind the hold is the same event whether they asked for it or the
model volunteered it. Neither path ever renders the model's own words, so a
parent who phrases the request more cleverly gets the same sentence as one who
asks plainly. Asking with no worksheet open is a third thing again: there is no
answer card to point at, so it is out of scope rather than withheld.

| Intent | What the parent sees |
|---|---|
| `coach` | The model's reply, the sentence to say, what to listen for |
| `answer_request` | Where the answer lives, plus the question already on screen |
| `out_of_scope` | One fixed sentence naming what this is for |
| guard fired on a `coach` reply | Exactly what `answer_request` produces |

The check suite exercises all four by calling `cardsForChatTurn` with a reply
that states the answer in every field, and asserts the string never survives.
Breaking the containment on purpose fails three assertions, which is how the
assertions were confirmed to be doing work rather than passing by construction.

## Step five: listening happens in the thread

The microphone in the composer was a link to another screen. It is a toggle
now, and Live Mode happens where the worksheet is.

Nothing about the listening itself moved house. Same hook, same rolling window
in the same ref, same five second classify interval, same rule engine with the
same hard cap of three interruptions and the same ninety second cooldown. What
moved is where the coaching lands.

On the old screen a nudge was a card sliding over a blank page, dismissed with
"Got it" and then gone. In the thread it is a turn, with the accent edge that
marks it as unprompted and the time it was earned. It stays in the log, which
is better: a parent who missed it at 00:34 can still find it at 04:00, and the
summary at the end sits under the nudges that led to it rather than on a page
the parent has to navigate to.

The full-screen treatment was right when listening was the only thing on the
page. Here the worksheet is the thing on the page, so listening shrinks to a
bar over the composer: the breathing mark, the clock, and the way out.

`/live` redirects into the thread, `components/LiveMode.tsx` is gone, and the
Park It screen came with it: the drafted note for the teacher is a card, with
the copy control it had before, because a parent who has just been told to stop
is not going to retype it.

## The transcript, finally asserted

Folding Live Mode into a persisted message log is the moment the promise that
nothing is kept is most likely to break, and until now that promise was true
only by inspection. Nine assertions now hold it:

- the rolling window is a ref, never React state, never storage
- it is cleared when listening stops
- `readWindow()` is called in exactly one place in the shell, and that place is
  the classify request body
- no field on a live card could hold it
- the `Move` row has no column for words
- the classify route neither persists nor returns it
- the recap model is given counts, never words

Confirmed the way the answer guard was: leaking the window into a card on
purpose fails two of them.

The other thing asserted here is the round one bug, which this step could have
reintroduced. The hook returns a fresh object every render, so an effect
depending on the object tore down the five second interval before it could
fire. The clock now lives in `LiveBar` rather than the shell, so the thread
does not re-render once a second for the length of a session, and the check
suite reads the effect's dependency list and fails if the hook object appears
in it.

| Found on screen | Fix |
|---|---|
| The clock started when the parent tapped, counting the permission prompt as homework | It starts when listening starts |
| "See the whole session" read as a sentence, not a link | Thread links take the accent and an underline; the global rule is `color: inherit`, which only works inside prose |

## Step six: a marketing site, four pages

The brief pinned the palette and the type in round two, so those were not free
axes here. What was free was how each page opens, and the hero is where a
generated page usually gives itself away.

Each page opens on a real artifact from the fixture instead of a slogan:

| Page | Opens on | Rejected |
|---|---|---|
| `/` | The demo packet, rendering live | A screenshot in a laptop frame |
| `/how-it-works` | The worksheet itself, in the child's handwriting | Three feature cards in a row |
| `/research` | The admission that the product is unevaluated | Three big numbers over citations |
| `/for-teachers` | The note a teacher actually receives | Testimonials, which would mean inventing a teacher |
| `/privacy` | The claim that each section names its file | "Your privacy matters to us" |

`/how-it-works` is numbered because it genuinely is a sequence, which is the
only case where numbered markers are honest. Each stage quotes what that stage
produced, pulled from the same fixture the product serves, so the page cannot
drift into describing a different product from the one behind the door.

`/research` is the page that mattered most to get right. The usual shape is
three large numbers over a citation, which invites a reader to take findings
about parents in general as results about this product. So the admission goes
first, in the standfirst, and each finding gets a third column saying what it
changed in the build. That column is the only part of the page about
ParentPilot, and the rule between it and the finding is the argument: those are
not the same kind of statement. No effect sizes are quoted, asserted by a check
that scans for percentages and p values.

`/privacy` now does what it always claimed. Every section names the file that
makes it true, and `scripts/check.ts` reads those paths off the page and fails
if one does not exist. A file that moves takes the page down with it rather
than leaving a citation pointing at nothing.

## What the screenshots and the checks caught

| Found | Fix |
|---|---|
| Four nav links plus a bordered call to action measured 478px in a 390px viewport, pushing all five pages sideways | On a phone the header is the logo and one door; the content links are in the footer and each page links onward in its own body |
| `/research` and `/privacy` left the right half of the hero empty | With no artifact beside it, the headline and the line under it become the two columns |
| Rewriting the footer orphaned `/setup` entirely, with nothing linking to it | The setup flow hangs off the account screen, where a parent with a child to add actually is |

The orphan is the one worth dwelling on, because nothing would have caught it:
the route built, the page rendered, and no test visited it. There is now a walk
over every route under `app/(site)` that fails when nothing links to it,
skipping redirect stubs, which exist precisely to be unlinked.

Four of the checks written across this round failed first time because they
scanned comments rather than code. The comment on `/for-teachers` says there
are no testimonials on it, which is exactly the word the ban scans for. There
is a shared `codeOnly()` helper now, and it is used everywhere a ban list runs.

## Step seven: the product's own pages

There were two surfaces and nine pages that belonged to neither. Settings,
account, history, setup, recap, the finished-work check: all of them wore the
teal marketing frame, so tapping "Account" inside the thread dropped a parent
onto a page advertising the thing they were already using.

So there is a third route group now. `app/(product)` has one line of chrome,
the way back, and `.pp-product` in globals.css points the sheet tokens those
nine screens were written against at the app palette. That restyles them
without rewriting them, and it is an alias layer rather than a second palette:
every value resolves to an `--app-*` token the contrast suite already checks in
both themes. Route groups contribute no path segment, so every URL is unchanged.

## The defect this uncovered

Pointing `--action` at the app palette meant computing what the app's action
colour actually was, which nobody had done. The thread's primary button was
`#ffffff` on `var(--accent)`: **3.06 to 1**, below AA for text at any size the
composer uses. It had been there since step three.

It survived the contrast suite because the foreground was a hex literal in a
component, and a sweep over tokens cannot see one. There are now
`--app-action` and `--app-action-label`, 7.00 in light and 9.01 in dark, plus
two rules that stop it recurring: no raw `var(--accent)` fill behind text, and
no hard-coded `color: "#..."` in either chat file.

## One renderer, not two

`/problem/[id]` rendered a packet, and so does the thread. Two renderers for
one thing is how the round two all-caps eyebrows survived three steps: they
were fixed in the thread in step three and nobody was looking at the other
screen, where "GRADE 5" and "ASK THIS, THEN WAIT" were still shouting.

The eyebrows came from `Label` in `components/ui.tsx`, which every product
screen uses, so fixing one component fixed about ten places. The assertion that
had been scoped to the two chat files now reads every component in the repo.

Before deleting the screen, the one thing it had that the thread did not was
ported: the spoken primer. Round three called it the highest-value thing in the
product for a parent who reads English with difficulty, and the surface that
replaced it had quietly dropped it. It is in the teaching card now.

`PacketScreen`, `PacketLoader`, `Disclosure` and `CaptureFlow` are gone.
CaptureFlow had been orphaned since step three, compiling and passing every
check, rendering nowhere. There is now a check for that too: a component
nothing imports fails the build, which is the same question the route walk asks
one level down.

| Found | Fix |
|---|---|
| The thread's primary button was 3.06:1 | `--app-action` and `--app-action-label`, plus two rules against the literals that hid it |
| "GRADE 5" and "ASK THIS, THEN WAIT" still shouting on the product screens | `Label` is sentence case; the all-caps rule reads every component now |
| `CaptureFlow` orphaned for three steps | Deleted, and orphaned components now fail the build |
| Settings said "How I write to you" and then "How I write" underneath | The control takes `heading={false}` where a section heading already names it |
| History's empty state was a heading holding a sentence and a bare link | A line saying what history is for, and the button that turns it on |
