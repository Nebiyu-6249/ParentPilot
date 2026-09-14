/**
 * Every user-facing string in ParentPilot passes through this module.
 *
 * Two jobs:
 *   1. Keep tone consistent by keeping the strings in one file.
 *   2. Enforce the em-dash ban in one place. The ban applies to model
 *      output as well as to hard-coded UI copy, so `sanitize` is called on
 *      everything the model writes before it reaches a component. The
 *      prompt files also carry the rule, but a prompt is a request and this
 *      is a guarantee.
 */

const EM_DASH = /—|―/g; // em dash, horizontal bar
const SPACED_EN_DASH = /\s–\s/g; // en dash used as an em dash

/**
 * Removes em dashes from a string without mangling the sentence.
 *
 * `a — b` and `a—b` both become `a, b`. A trailing dash becomes a full
 * stop. Numeric ranges written with an unspaced en dash (`3-6`) are left
 * alone, since the ban is on the rhetorical dash, not on ranges.
 */
export function sanitize(input: string): string {
  return input
    .replace(SPACED_EN_DASH, ", ")
    .replace(/\s*(?:—|―)\s*$/g, ".")
    .replace(/\s*(?:—|―)\s*/g, ", ")
    .replace(EM_DASH, ", ")
    .replace(/ {2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** Recursively sanitizes every string in a parsed model response. */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") return sanitize(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }
  return value;
}

/** Tagged template that sanitizes interpolated copy at the call site. */
export function t(strings: TemplateStringsArray, ...values: unknown[]): string {
  return sanitize(strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ""), ""));
}

export const copy = {
  brand: {
    name: "ParentPilot",
    tagline: "Homework help that talks to you, not to your child.",
  },

  nav: {
    capture: "New worksheet",
    live: "Live Mode",
    check: "Check finished work",
    settings: "Settings",
    privacy: "Privacy",
  },

  landing: {
    thesis:
      "Your child is being taught a method you were never taught. ParentPilot reads the worksheet, works out what is actually being asked, and gives you the questions to ask. It never speaks to your child.",
    audioPromise:
      "Live Mode listens through your browser. The audio never leaves your device and is never stored. We keep only what kind of thing was said and when, never the words.",
    researchHeading: "Why this is built the way it is",
    research: [
      {
        claim: "Parents who are anxious about math pass that anxiety to their children, but only when they help with homework.",
        source: "Maloney, Ramirez, Gunderson, Levine and Beilock, Psychological Science, 2015",
      },
      {
        claim: "Praise aimed at effort and strategy sustains persistence. Praise aimed at the person does not.",
        source: "Gunderson et al., Child Development, 2013",
      },
      {
        claim: "Autonomy-supportive help produces better learning than help that takes over the task.",
        source: "Grolnick and Ryan, Journal of Personality and Social Psychology, 1989",
      },
      {
        claim: "Waiting three seconds or more after asking a question measurably lengthens and improves the answer.",
        source: "Rowe, Journal of Teacher Education, 1986",
      },
    ],
    tryButton: "Try it on this worksheet",
    tryNote: "Runs on a saved example. No photo, no account, no cost.",
    primaryCta: "Start with a worksheet",
    secondaryCta: "Set up in four steps",
    noChild: "No child account. No student login. Nothing for your child to sign into.",

    /* Three lines, in a column. Each one is a step a parent actually takes,
       not a feature name. The icon labels the step; it is not decoration. */
    steps: [
      { icon: "camera", text: "Photograph the worksheet, their working and all." },
      { icon: "type", text: "Check what we read. Fix a misread line in one tap." },
      { icon: "lock", text: "Five questions to ask. The answer stays behind a press and hold." },
    ],

    /* One citation earns credibility in a glance. The rest sit behind a
       disclosure, because a parent at 8pm wants to start, not to read a
       literature review. */
    researchMoreLabel: "The rest of the research this is built on",
  },

  setup: {
    heading: "Four quick questions",
    subheading: "This takes about a minute and it changes everything you see afterwards.",
    step1: {
      heading: "Which of these reads best to you?",
      help: "There is no right answer. Pick the one you would want to read at 8pm.",
    },
    step2: {
      heading: "How was math at school for you?",
      help: "This is never shown back to you as a score. It only changes how often Live Mode speaks up.",
      options: [
        { band: 1, label: "I loved it" },
        { band: 2, label: "Fine, but I have forgotten most of it" },
        { band: 3, label: "I got by, never enjoyed it" },
        { band: 4, label: "Genuinely miserable" },
      ],
    },
    step3: {
      heading: "About your child",
      help: "A first name is optional. We use it only inside the scripts we write for you.",
      gradeLabel: "Grade",
      nameLabel: "First name (optional)",
      curriculumLabel: "Curriculum",
      subjectsLabel: "Subjects",
    },
    step4: {
      heading: "What language should I talk to you in?",
      help: "This is the language of your primer and your scripts. It is separate from the language the worksheet is written in.",
    },
    finish: "Done, take me to the worksheet",
    next: "Next",
    back: "Back",
  },

  capture: {
    heading: "Show me the worksheet",
    help: "A photo of the page, including whatever your child has already written. Their working is the useful part.",
    photoLabel: "Take or choose a photo",
    textLabel: "Or type the problem",
    textPlaceholder: "For example: 1/4 + 2/3 =",
    childWorkLabel: "What your child has written so far (optional)",
    submitPhoto: "Read this worksheet",
    submitText: "Use this problem",
    sizeLimit: "Images only, up to 6MB, one page at a time.",
    tooLarge: "That image is over 6MB. A smaller photo reads just as well.",
    wrongType: "That file is not an image. A photo of the page works best.",
  },

  status: {
    reading: "Reading her working",
    checking: "Checking the arithmetic",
    matching: "Matching it to what the class is teaching",
    writing: "Writing your primer",
    almost: "Almost there",
  },

  transcription: {
    heading: "Here is what I read",
    help: "Check this before I write anything. If I misread a line, fix it now and everything downstream will be right.",
    printedLabel: "The printed question",
    workLabel: "Your child's working",
    answerLabel: "Your child's answer",
    edit: "Edit",
    save: "Save and continue",
    lowConfidence: "I cannot read that line clearly. Can you type it?",
    confirm: "That is right, carry on",
  },

  packet: {
    primerHeading: "What is actually being taught",
    methodHeading: "Method Match",
    yourMethodLabel: "The way you were taught",
    schoolMethodLabel: "The way the class is doing it",
    bothCorrect: "Both of these are correct. The class wants the second one because it shows the thinking.",
    hintHeading: "Five questions, in order",
    hintHelp: "Ask one. Wait. Only move to the next if the wait produced nothing.",
    hintReveal: "Show the next question",
    hintDone: "That is all five.",
    answerHeading: "The answer",
    answerHold: "Press and hold to reveal",
    answerHolding: "Keep holding",
    answerWhy: "It is behind a hold because reaching for it is the easy thing to do, and it is the one thing that ends the learning.",
    verifiedBadge: "Checked",
    unverifiedBadge: "Unverified",
    verifiedHelp: "We recomputed this in code, separately from the model, and the two agreed.",
    unverifiedHelp:
      "Our own calculation did not match the model, so we are not showing an answer. The questions above are still sound.",
    scriptsHeading: "What to say, and what to skip",
    scriptAvoid: "Skip",
    scriptUse: "Try",
    isomorphHeading: "Three more like it",
    isomorphHelp: "Same idea, different numbers. Use these once the first one has clicked.",
    misconceptionHeading: "What went wrong",
    misconceptionRepair: "The question that fixes it",
    genericFallback:
      "I could not generate a fresh primer for this one, so this is the saved general explanation for this topic. It is accurate but not tailored to your child's working.",
  },

  live: {
    heading: "Live Mode",
    intro:
      "I will listen while you two work. The audio stays in your browser, is never uploaded and is never stored. I keep only what kind of thing was said and when.",
    micPrompt: "Start listening",
    micDenied: "Your browser did not give us the microphone. Live Mode needs it, and nothing else does.",
    unsupported: "This browser does not do speech recognition in-page, so we will send short audio chunks for transcription instead. They are transcribed and discarded, never stored.",
    stop: "End session",
    listening: "Listening",
    cardDismiss: "Got it",
    parkHeading: "Park it",
    parkBody:
      "This one has gone long enough. Stop here. Nothing is lost by leaving it, and the note below tells the teacher exactly where you got to.",
    parkNoteHeading: "A note for the teacher",
    parkCopy: "Copy the note",
    parkCopied: "Copied",
    cardsSpent: "That is all the interrupting I will do this session.",
  },

  cards: {
    ANXIETY_STATEMENT:
      "That sentence is the one thing research says actually transmits. Try: 'this one's tricky, let's figure it out together.'",
    GENERIC_PRAISE:
      "Try naming what she did: 'you checked your answer before moving on, that's the part that matters.'",
    TAKES_OVER: "You've been talking for 40 seconds. Ask something and wait.",
    ESCALATION: "Take 20 seconds. Get a glass of water. Nothing is lost.",
    PRODUCTIVE_WAIT: "Let her think. This silence is the work.",
  },

  check: {
    heading: "Check the finished work",
    help: "I will tell you what kind of mistake is there. I will not tell you the answers, and I will not mark it for you.",
    submit: "Look at this",
    resultHeading: "What I can see",
    clean: "Nothing here looks like a misunderstanding. The working holds together.",
    noAnswers: "By design, this screen never shows answers. That is the point of it.",
  },

  recap: {
    heading: "How that went",
    ratioLabel: "Autonomy support",
    ratioHelp:
      "Questions asked, specific praise and time spent waiting, measured against answers given, generic praise, criticism and taking over. Higher means your child did more of the thinking.",
    movesHeading: "What happened",
    noMoves: "Nothing was classified in this session, so there is nothing to report.",
    again: "Back to the worksheet",
  },

  settings: {
    heading: "Settings",
    registerHeading: "How I write to you",
    registerHelp: "Changes every word on the screen you are looking at. It does not reload the page.",
    languageHeading: "Language",
    anxietyHeading: "How often Live Mode speaks up",
    exportHeading: "Your data",
    exportButton: "Export everything as JSON",
    deleteButton: "Delete everything",
    deleteConfirm: "This deletes your profile, your children's profiles, every worksheet and every session. It cannot be undone. Type DELETE to confirm.",
    deleted: "Deleted. Nothing of yours is left on our side.",
  },

  register: {
    heading: "How I write",
    options: [
      { value: "PLAIN", label: "Simpler" },
      { value: "STANDARD", label: "Standard" },
      { value: "TECHNICAL", label: "More technical" },
    ],
  },

  limits: {
    banner: "Demo limit reached for today. Showing a saved example.",
    spendBanner: "We have hit today's spending ceiling. Showing a saved example instead of an error.",
    // Used when there was no limit and no failure, there is simply nothing to
    // look up. Saying "limit reached" here would be a small lie, and this is a
    // product whose whole pitch is that its claims are true.
    demoBanner: "Showing a saved example.",
    // No model configured in this environment. Distinct from a limit, and
    // distinct from a failure, so it gets its own honest sentence.
    unconfiguredBanner:
      "This deployment is not set up to read new worksheets yet, so this is a saved example.",
  },

  errors: {
    modelTimeout: "The model took too long twice, so this is the saved general explanation for this topic.",
    malformed: "The model sent something we could not read, so this is the saved general explanation for this topic.",
    noProblem: "That worksheet did not give us a problem we could read. A straighter, closer photo usually fixes it.",
    notFound: "That page is not here.",
    generic: "Something went wrong on our side. Nothing of yours was lost.",
  },

  ops: {
    heading: "Operations",
    passwordLabel: "Password",
    enter: "Enter",
    wrong: "Wrong password.",
    todayHeading: "Today",
    failuresHeading: "Last 20 failures",
    resetDemo: "Reset demo data",
    noFailures: "No failures recorded.",
  },

  common: {
    back: "Back",
    cancel: "Cancel",
    continue: "Continue",
    loading: "Working",
  },
} as const;

export type Copy = typeof copy;
