# Seed data

Three kinds of file, and they are governed differently.

## `standards.json`, `standards-england.json`, `standards-cbse.json`

The corpus retrieval searches. One file per curriculum, each an array of the
same shape. `scripts/seed.ts` reads all three and upserts by `id`, so a file
can be filled in later without disturbing what is already loaded.

**Nothing in these files is written by a model.** They are transcribed from a
published curriculum document by a person, because a standards corpus written
by the thing it is used to evaluate is a mirror rather than a measurement, and
because a parent shown "what the class is doing" has been told a fact about
their child's school. An invented one is worse than none.

### Fields

| field | what it is |
|---|---|
| `id` | Unique across every file. Use the code. |
| `code` | The published identifier, as the curriculum writes it. `CCSS.MATH.5.NF.A.1`, `Y5-NF-1`, `CBSE-5-NUM-3`. |
| `curriculum` | `CCSS`, `ENC` (England National Curriculum) or `CBSE`. Must match the file. |
| `grade` | 0 for kindergarten or reception, then 1 to 8. Convert year groups: England Year 4 is `grade: 3`, because an English Year 4 child is the age of a US grade 3 child. |
| `plainLanguage` | One or two sentences saying what the child is learning, in the words a parent would use. Not the curriculum's own wording, which is written for teachers. This is the text that gets embedded, so it decides retrieval quality more than any other field. |
| `expectedMethods` | Two to four strings. How the classroom teaches it. The right-hand column of Method Match. |
| `parentMethod` | One string. How an adult was most likely taught the same thing. The left-hand column. Not a worse method, a different one. |

### Writing `plainLanguage` well

The embedding is built from this field, and probes are worksheet lines. So
write it the way a worksheet talks, not the way a standards document does.

- Good: "Adding and subtracting fractions with different denominators by
  finding a common way to cut the whole."
- Bad: "Pupils should be taught to add and subtract fractions with different
  denominators and mixed numbers, using the concept of equivalent fractions."

The second is the source document's sentence. It will match other standards
documents and not a child's homework.

### Scope

Grades 3 to 6 for England and CBSE, matching the existing Common Core corpus.
Roughly 60 to 70 entries each, weighted the way the Common Core file is:
number and fractions heaviest, geometry lightest.

## `misconceptions.json`

**Stays English and is not translated.** It is canonical data: one description
per misconception, shared by every locale, rendered into the parent's language
at generation time by the prompt. Translating the file would mean twenty
descriptions times four languages drifting apart, and the thing that must not
drift is the description a match is judged against.

`standardCode` points into the standards corpus. A misconception that belongs
to more than one curriculum's standard needs one row per curriculum, because
the code is the join.

## `demo-packet.json`

The saved example the landing page and the empty thread run on. One problem,
one packet per register. Not part of the corpus and never retrieved.
