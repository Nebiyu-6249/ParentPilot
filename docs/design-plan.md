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
