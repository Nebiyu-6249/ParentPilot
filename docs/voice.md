# Voice Mode

Stage one. Press to talk, Whisper, the existing thread pipeline, a spoken
reply. No Realtime API, no streaming audio, no barge in.

## It is not Live Mode

These are two features and the product works hard to keep them apart, because
the failure is not cosmetic: a parent who confuses them either believes they
are being recorded when they are not, or talks at a microphone that is only
classifying and never answers.

| | Voice Mode | Live Mode |
|---|---|---|
| Control | Microphone, in the composer | Sound arcs, in the top bar |
| Interaction | Press and hold, one question | Toggle, runs for a session |
| Scope | One message | The whole working session |
| It answers | Yes, out loud | Never. It raises coaching cards |
| The audio | Always leaves the browser, transcribed and dropped | Normally never leaves the browser at all |

The two controls are deliberately in different places, carry different
glyphs, and are each labelled in words. Neither can be used while the other
is active. The listening indicator names the mode before it says what it is
doing, so a screen reader announces which one is on first.

`npm run check` asserts the split, and `npm run check:ui` asserts it in the
rendered page, including that the two do not share an icon.

## The overheard constraint

Every other guarantee in this product is about a screen. A parent reads the
screen; the child does not. Speech breaks that arrangement, because the reply
is in the air and the nine year old at the same table hears all of it.

So the spoken rendering is a **different artefact** from the written one, not
a translation of it. `prompts/voice-turn.md` produces it. The written reply
may be franker: it can name the misconception, use the child's name, and say
what went wrong, because only the parent reads it.

### What the spoken reply may never do

1. **Say the answer.** Asked out loud for it, the reply is *"It is on your
   screen, behind the hold."* and nothing else. A near miss said aloud is the
   answer said aloud with extra steps.
2. **Name what the child got wrong.** The misconception is given to the
   prompt so it knows what the coaching is for, not so it can say it.
3. **Correct the child out loud.**
4. **Use the child's name.** The parent knows who they are helping. A name in
   a spoken sentence turns a private coaching line into something addressed
   at the table.

### How that is enforced

The prompt asks. `lib/voice.ts` decides, and it runs on the server before
anything is synthesised:

```
look up the problem's facts  ->  ask for a rendering  ->  check it  ->  speak
```

`app/api/voice/speak/route.ts` is the only entrance to speech synthesis in
the product, and every fact the check runs against is looked up there rather
than accepted from the request. A client that posts
`writtenReply: "it comes to 11/12"` gets the fallback line read back to it.

Three things are checkable exactly and they are the three worst outcomes: the
computed answer, the misconception's vocabulary, and the child's name. A
short list of English verdict phrases is checked too. **Everything past that,
tone and implication, is the prompt's job and the eval's job to measure.**
`lib/voice.ts` does not pretend to judge it; a check that claimed to and
could not would be worse than one that states its limits.

On any failure the rendering is **replaced**, not flagged, so a caller that
forgets to look at the verdict still cannot synthesise an unsafe line. The
substitution is written to the failure log, because a rendering that had to
be replaced is the prompt failing at the one thing it exists for.

## The toggles

**"She can hear this"**, default on, lives on the composer rather than in
Settings. It changes what is said out loud in the next ten seconds, and a
safety control a parent has to go and find is one most parents never see.

Turning it off relaxes the name and the misconception, which are only unsafe
because of who is listening. **It does not unlock the answer.** A parent who
has stepped into the hall is still a parent this product does not read
answers to; the press and hold is the only route to one.

**Keep the mic open**, default off, reopens the microphone for four seconds
after a reply so a follow-up needs no button. Bounded rather than open ended:
a microphone that stays on until something happens is a microphone nobody is
sure is off.

## Privacy

Recorded audio is posted, transcribed and dropped. It is not written to disk,
not written to the database, and not retained after the request returns.
There is no column it could go in. Nothing in `useVoiceMode` holds a
transcript in state.

Spoken replies are never cached. A spoken reply belongs to one turn in one
kitchen.

## Voices and cost

One TTS voice per launch language, in `VOICES` in `lib/ai/provider.ts`. The
primer's audio is cached on the packet cache key plus the voice, so changing
the mapping does not serve a parent audio in the old one. Every synthesis
increments the spend ledger and is metered like any other model call.

**Nobody has listened to all four voices yet.** They are picked for steadiness
on non-Latin script rather than for character, which is a reasonable guess and
not a decision. Worth ten minutes with headphones before launch.

## What stage two would add

Realtime API: streaming audio both ways, interruption, no press and hold. The
reason it is not here is the check above. Stage one has four round trips a
parent can hear, which is worse latency than a socket and is also four places
where the overheard check can sit. A realtime stream has to make the same
guarantee against tokens arriving one at a time, and that is a different and
harder piece of work than making it against a finished sentence.
