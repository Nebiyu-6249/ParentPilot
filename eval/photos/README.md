# Vision fixtures

Photographs of real worksheets, with what we expect to be read off them. The
vision section of `npm run eval` runs every file listed in `expected.json`
through the same `extractWorksheet` call the product makes, and compares.

Drop the images in this directory and add an entry each to `expected.json`.
Nothing here is committed by the harness and nothing is generated: these are
hand-checked by a person looking at the page, which is the only thing that
makes them worth measuring against.

## What to put here

Aim for about twelve, spread across these. The list is ordered by how often
the failure shows up in the product rather than by how hard it looks.

1. **Handwritten working, clearly legible.** The ordinary case, and the one
   that has to be near perfect. A printed question with a child's pencil
   working under it.
2. **Handwritten working with crossings out.** The child changed their mind.
   The crossed-out line is often where the misconception is visible, so it
   has to be transcribed and marked, not silently dropped.
3. **A stacked fraction.** Written vertically on the page, expected back as
   `3/4`. This is the commonest transcription error in the product.
4. **A long division or column subtraction laid out vertically**, with
   carries and borrows written small above the digits.
5. **A page at an angle**, photographed across a kitchen table rather than
   square on, with the page edge and some tablecloth in frame.
6. **A page in shadow**, half lit by a lamp. Very common in the evening,
   which is when this product is used.
7. **Multiple problems on one page**, numbered, so ordering and `index` can
   be checked.
8. **A word problem with no arithmetic on the page at all.** Tests that
   `childWorkText` comes back `null` rather than an invention.
9. **A blank worksheet**, nothing written by the child. Same test, harder.
10. **A worksheet in a language other than English.** Transcription stays in
    the language on the page; only the prose around it is translated.
11. **A page with a diagram**, a bar model or a number line, where part of
    the question is not text.
12. **One deliberately unreadable photo.** Out of focus, or moving, or far
    too dark. This is the fixture the harness is strictest about: see below.

## The blurry fixture

`expected.json` must contain exactly one entry with `"unreadable": true`.
Name the file `blurry.jpg`, or change the entry to match what you name it.

It is the only fixture with a pass condition that is about refusing rather
than about accuracy. The model must report `ocrConfidence` below `0.7`, or
return no problems at all with a `pageNote` saying so. A confident
transcription of a page nobody can read is the worst failure the vision step
has, because everything downstream trusts this text: the arithmetic check,
the standard match, the misconception, the whole packet. A wrong digit read
confidently becomes a parent being told their child holds a belief they do
not hold.

So make it genuinely unreadable. A photo that is merely difficult teaches
the harness nothing.

## Privacy

These are checked into the repository, so use worksheets you are happy to
publish. No child's name in frame, no school letterhead, no address on a
homework diary. If a page has a name on it, cover it before photographing
rather than cropping afterwards, because a crop can be undone.
