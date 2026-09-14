---
name: frontend-design
description: Use when building or reshaping any UI — a new page, a component set, a visual direction, or a restyle. Enforces a two-pass process (plan, then self-review against known generic defaults, then code) so the result reads as designed rather than generated. Trigger whenever a task involves layout, colour, typography, spacing, or "make this look better".
---

# Frontend design

The failure mode this exists to prevent: producing a competent, tasteful, completely generic interface that looks like every other AI-built site. Competence is not the bar. The bar is that the design could only belong to this product.

## The two-pass process

Never write UI code directly from a brief. Always:

### Pass 1 — Write the plan

Before any code, produce a short plan containing:

1. **The idea in one or two sentences.** Not adjectives. A concrete image or situation the interface is drawn from. "Clean and modern" is not an idea. "A teal desk at eight in the evening with paper on it and a green pen" is.
2. **Named tokens with actual values.** Surfaces, text, accents, rules, states. Semantic names that map to roles, not to colours: `--surface-sheet`, not `--cream`. Light and dark are two value sets behind one semantic layer, never two code paths.
3. **Type scale.** Families, weights, sizes, and where each is allowed to appear. Restrict the display face to one or two places. A serif heading on every section is a tell.
4. **Layout system.** Max width, grid, the rhythm of the page. Say what makes it asymmetric or otherwise particular.
5. **What this deliberately is not.** Name the obvious default you are avoiding.

### Pass 2 — Review the plan before coding

Read your own plan back and hunt for defaults. For each item found, either remove it or write down why it earns its place here specifically. Expect to find three or more; if you find none, you have not looked hard enough.

Only then write code.

### Pass 3 — Look at the result

Building it is not finishing it. Screenshot the rendered page at desktop and mobile, in both modes, and read what is actually there. Bugs that survive review are almost always visual: an element covering another, text at a contrast that computed fine in a token pair but fails in context, an artifact below the fold on the case you called primary.

## Known generic defaults

These are the clusters that machine-generated interfaces fall into. Treat any of them as a signal to stop and reconsider, not as an automatic ban.

**Palette and surface**
- Warm cream background near `#F4F1EA` paired with a high-contrast serif display
- Near-black on near-white with a single saturated accent and nothing else
- Purple-to-blue or any multi-stop gradient as a hero surface
- Dark mode produced by inverting lightness rather than by designing a second variant

**Layout**
- Broadsheet or editorial layout: hairline rules, zero border radius, a single centred column of body text in a sea of empty space
- A bento grid of unequal boxes
- Three feature cards in a row, each with an icon, a heading and two lines
- Everything centred, top to bottom, with no asymmetry anywhere

**Type**
- A serif display heading on every section
- Tracked-out all-caps eyebrow labels above headings
- One word inside a headline coloured in the accent
- Inter, Geist or Space Grotesk chosen by default rather than for a reason

**Ornament**
- Sparkle icons, particularly four-pointed diamonds, to signal AI
- Glassmorphism, radial orbs, dot grids, animated arrows, confetti
- A terminal window mockup as decoration
- Icons used as decoration rather than as labels for actions

**Content**
- Invented testimonials and fake logos
- Three pricing tiers with the middle one highlighted
- "It's not X, it's Y" as a rhetorical move
- A page that describes the product instead of showing it

## Ground the design in the subject

The strongest source of distinctiveness is the subject matter itself, not a style reference.

Ask: what does this product's world actually look like? What objects, materials, marks and situations belong to it? A homework product's world contains paper, pencil, worksheets and a teacher's annotations. A trading product's world contains tickers, ladders and fills. Build the visual language out of that.

**Open with the most characteristic thing in the subject's world.** A live demo, a real artifact, the actual output. Not a headline describing it. If the first screen is all type, the design has not started.

## Convention versus distinctiveness

These pull against each other and the brief decides which wins.

Follow convention closely on **interaction**: where the nav is, what a text input looks like, where the primary action sits, what a disabled state means. Jakob's Law is real — people expect your product to work like the ones they already use, and making them learn a bespoke interaction is a cost with no return.

Spend the distinctiveness budget on **content and identity**: the cards, the artifacts, the illustrations, the way this product's particular output is rendered. That is where being unlike anything else is an asset rather than a tax.

## Accessibility is part of the design, not a pass afterwards

- Compute contrast for every token pair in both modes. Body text at 4.5:1, large text and non-text at 3:1.
- A colour that carries meaning must be legible. An annotation mark nobody can see is a defect, not a style choice.
- Check the pairs that appear in rendered content, not only the ones declared in the stylesheet. Hardcoded colours inside SVGs, emails and seeded data are the usual hiding place.
- Respect `prefers-reduced-motion`. An animation that is merely disabled rather than skipped can leave a static overlay sitting over the page.
- Keyboard reachability and visible focus on every interactive element.

## Rules of thumb

- The brief's own words always win. If the brief says something this document discourages, the brief is right.
- No screen should require scrolling to reach its primary action.
- If a screen has more than one primary action, it has none.
- Motion is slow and settling, or it is absent. Nothing bounces.
- Prefer one strong idea executed fully over three hedged ones.
