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

  /* The marketing site. Four pages, each answering one question a specific
     person actually has: what happens to my photo, does any of this hold up,
     will this undermine my classroom, and what do you keep. */
  howItWorks: {
    heading: "What happens to the photograph",
    standfirst:
      "Five stages between the page on your table and the question you ask out loud. None of them is the answer.",
    artifactCaption: "The saved worksheet this site is built from. Everything below is what happens to it.",
    checkedLine: "Checked in code, not by a model",
    stages: [
      {
        title: "We read the page",
        body: "A model transcribes the printed question and your child's handwriting, and reports how confident it was about each line. You see what we read before anything else happens, and you can fix a misread line in one tap.",
        shows: "read" as const,
      },
      {
        title: "We check the arithmetic ourselves",
        body: "Not with a model. The sum is recomputed in exact fractions by a library, and the result is compared to what the packet says. When the two disagree, or when the problem is not one we can compute, we say so and the answer stays hidden rather than being shown unverified.",
        shows: "checked" as const,
      },
      {
        title: "We work out what is being taught",
        body: "The problem is matched against a corpus of curriculum standards, so the explanation you get is about the idea the class is working on rather than about the shortcut that would get past this one question.",
        shows: "standard" as const,
      },
      {
        title: "We name the mistake, when there is one",
        body: "Twenty documented misconceptions, each with a signature in the working and a question that surfaces it. A wrong answer that is just a slip is called a slip. We do not invent a misunderstanding to have something to say.",
        shows: "misconception" as const,
      },
      {
        title: "You get the question to ask",
        body: "Five of them, in escalating order, one at a time. You tap for the next one only when you need it. The answer sits behind a press and hold, so opening it is a decision rather than something you read by accident.",
        shows: "ask" as const,
      },
    ],
    notHeading: "What it does not do",
    notList: [
      "It never speaks to your child. There is no child account, no student login and no screen for them to read.",
      "It does not give you the answer in a sentence. Not in a reply, not in a summary, not when you ask for it directly.",
      "It does not teach your method. If the class is doing common denominators, that is what you get, even if you would have cross multiplied.",
      "It does not grade your child, score your parenting, or keep a streak.",
    ],
    failHeading: "When it cannot do the job",
    failBody:
      "A blurred photo, a topic outside the corpus, a model that times out twice, a spending ceiling reached: all of these happen, and all of them produce a visible notice saying what went wrong rather than a confident-looking answer built on nothing.",
    failBodyTwo:
      "When the arithmetic cannot be verified in code, the answer is not merely hidden behind the hold, it is absent from the data sent to your browser. There is nothing there to reveal.",
  },

  research: {
    heading: "What this is built on, and what it has not shown",
    standfirst:
      "ParentPilot has not been evaluated. No trial, no control group, no published result. Nothing on this page is a claim about this product.",
    admissionHeading: "The honest position",
    admission:
      "Four findings shaped how this is built. Each one is about parents, children and homework in general, not about this app. A product that cites research it did not run is describing its reasoning, not its results, and the two are easy to blur on purpose. We would rather say it plainly than imply otherwise with a graph.",
    tableHeading: "The four findings",
    columnFinding: "Finding",
    columnSource: "Source",
    columnConsequence: "What it changed here",
    entries: [
      {
        finding:
          "Parents who are anxious about math pass that anxiety to their children, and the effect appears only among parents who help with homework often.",
        source: "Maloney, Ramirez, Gunderson, Levine and Beilock, Psychological Science, 2015",
        consequence:
          "The product never asks the parent to explain anything. It hands them a question to ask, so the help they give does not require them to perform competence they do not feel.",
      },
      {
        finding:
          "Praise aimed at effort and strategy sustains persistence later. Praise aimed at the person does not.",
        source: "Gunderson and colleagues, Child Development, 2013",
        consequence:
          "Live Mode raises a card for generic praise and suggests naming what the child actually did. Praise is never scored or counted against the parent.",
      },
      {
        finding:
          "Help that supports a child's autonomy produces better learning than help that takes over the task.",
        source: "Grolnick and Ryan, Journal of Personality and Social Psychology, 1989",
        consequence:
          "The hint ladder escalates one rung at a time and the answer is locked. The session summary measures questions asked and silences waited through against answers given.",
      },
      {
        finding:
          "Waiting several seconds after asking a question lengthens and improves the answer that comes back.",
        source: "Rowe, Journal of Teacher Education, 1986",
        consequence:
          "Every question on the ask card is labelled with the instruction to wait, and a long silence after a question is classified as productive rather than as nothing happening.",
      },
    ],
    corpusHeading: "The curriculum corpus",
    corpusBody:
      "Standards are matched against a hand-written corpus covering grades three to six, and the twenty misconceptions are documented ones with a stated signature in a child's working. The corpus is small and its limits are visible: a problem outside it produces a general explanation and says that is what it is.",
    limitsHeading: "What would actually settle it",
    limitsBody:
      "A trial comparing families using this against families using nothing, measuring both the child's learning and the parent's anxiety, over a term rather than an evening. Until somebody runs one, the right description of this product is a careful application of other people's findings.",
    howLink: "See what it actually does",
  },

  forTeachers: {
    heading: "It will not undo your lesson",
    standfirst:
      "The worry is reasonable: a parent with an AI at the kitchen table teaching the shortcut you spent three weeks getting them past. Here is what stops that.",
    noteCaption: "The note a family sends you when they stop. Drafted by the product, sent by the parent.",
    /* An example of the shape the note takes. Written by hand for this page
       and labelled as an example, because a real one would be a real child. */
    sampleNote:
      "Hello, we spent about twenty five minutes on the fractions homework tonight and stopped before finishing. She could add fractions with the same denominator confidently. Adding quarters to thirds is where it came apart: she added the denominators as well as the numerators. I did not want to teach her a shortcut that contradicts what you are doing in class, so we left the last three questions.",
    misconceptionLabel: "Documented misconception matched:",
    seeIt: "See the product",
    promisesHeading: "Four things it will not do",
    promises: [
      {
        title: "It does not give the answer",
        body: "Not in a reply, not in a summary, not when a parent asks for it outright. The answer sits behind a press and hold, and the request for it is answered with the next question instead.",
      },
      {
        title: "It teaches the method you are teaching",
        body: "Every explanation is anchored to a curriculum standard. Where the parent's own method differs, both are shown side by side and the class method is the one the questions follow.",
      },
      {
        title: "It never speaks to the child",
        body: "There is no child account and no screen for a child to read. Everything it produces is addressed to the adult, including the sentences they are meant to say out loud.",
      },
      {
        title: "It stops rather than pushing",
        body: "Twenty minutes on one problem, or a session that has turned sharp, ends the session and drafts you a note. Unfinished homework with an explanation is better for you than finished homework that was really the parent's.",
      },
    ],
    noteHeading: "The note",
    noteBody:
      "When a session is parked, the product drafts a note saying what the child could do, where it came apart, and why they stopped. The parent reads it, edits it, and sends it. Nothing reaches you automatically and nothing is sent without a parent choosing to.",
    standardsHeading: "Standards",
    standardsBody:
      "Grades three to six, matched against a hand-written corpus. Every packet cites the standard it was built from, and a parent can open the citation to read the plain-language version of it. When a problem falls outside the corpus, the product says so rather than guessing at a standard.",
    askHeading: "If it gets something wrong",
    askBody:
      "It will. A misread line, a standard matched to the wrong idea, a misconception named where there was only a slip. The parent sees what was read before anything is built on it, and every packet says how confident the reading was. If you want a topic or a misconception handled differently, that is a change to the corpus, which is hand written and reviewable rather than learned.",
  },

  nav: {
    howItWorks: "How it works",
    research: "Research",
    forTeachers: "For teachers",
    openApp: "Open ParentPilot",
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
    researchLink: "What this is built on, and what it has not shown",
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
    thinking: "Reading what you wrote",
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

    /* The screen is one question. Everything below is a closed disclosure,
       because a parent mid-session needs the thing to say, not an essay. */
    askLabel: "Ask this, then wait",
    rungCounter: (n: number, total: number): string => `Question ${n} of ${total}`,
    stillStuck: "Still stuck",
    answeredIt: "She answered it",
    ladderExhausted:
      "That was the last one. If it is still not landing, the answer is at the bottom of this screen, and stopping here is a perfectly good outcome.",

    solvedHeading: "Good. That one is done.",
    solvedBody:
      "She got there by answering a question rather than being told, which is the part that sticks.",
    solvedAgain: "Back to the questions",

    /* Disclosure titles, in the order a parent reaches for them. The answer is
       last on purpose: it is the escape hatch, so it sits furthest from the
       thumb. */
    discloseWhy: "Why she got it wrong",
    discloseMethods: "Show me both methods",
    discloseTeaching: "What is this teaching?",
    discloseScripts: "What to say, and what to skip",
    discloseAnswer: "Just tell me the answer",
    primerMore: "Read the whole thing",
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
    /* Shown when listening ends with nothing recorded: no database, or the
       end call failed. Saying the session was not counted is better than a
       summary card full of zeros, which would read as a bad session. */
    endedUnrecorded: "Listening has stopped. Nothing was recorded, so there is no summary for this stretch.",
    /* The microphone in the composer, which is a toggle rather than a link
       now that Live Mode happens in the thread. */
    startInThread: "Listen while we work",
    stopInThread: "Stop listening",
    heardAt: "Heard at",
    oneThingLabel: "One thing to try next time",
    fullRecap: "See the whole session",
    overMinutes: (minutes: number) => `over ${minutes} minute${minutes === 1 ? "" : "s"}`,
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

  /* Provenance, shown quietly whenever a packet did not come from a live
     reading of this parent's worksheet. A degraded response that looks
     identical to a real one is the worst outcome, because the parent acts on
     it believing we read the page. */
  provenance: {
    fixture: "This is a saved example, not a reading of your worksheet.",
    generic: "The model did not answer, so this is the saved general explanation for this topic rather than one written for your child's working.",
  },

  chat: {
    emptyIntent: "Show me the worksheet and I will tell you what to ask.",
    emptyPhoto: "Take a photo of the page",
    emptyDemo: "Or watch it run on a saved worksheet",
    /* What the child wrote on the saved page, so the card shows what is about
       to be worked on rather than only promising that something will be. */
    emptyDemoWork: "She added the denominators and wrote 3/7.",
    emptyDemoNote: "No photo, no account, no cost.",
    /* The parent's own turn in the thread. The button label is an offer; this
       is what the parent just did, which is what a transcript should say. */
    demoTurn: "Run the saved worksheet.",
    photoTurn: "Here is the worksheet.",
    /* One job. The camera sits directly to its left and makes the other
       offer, and the two-clause version wrapped and clipped on a phone. */
    placeholder: "Tell me what is happening",
    note: "ParentPilot talks to you, never to your child.",
    newThread: "New worksheet",
    threadsToday: "Today",
    threadsWeek: "This week",
    threadsEarlier: "Earlier",
    /* The answer is behind the press and hold on every surface, and a chat
       reply is not an exception. Shown both when the parent asks outright and
       when the guard catches a model stating it anyway; from where the parent
       sits those are the same event. */
    answerHeld:
      "I keep the answer behind the hold on the answer card, so opening it is a deliberate tap rather than something you read by accident.",
    answerHeldNext: "Before you open it, try this one:",
    /* Scope. Being narrow is the product, so the refusal names what this is
       for rather than apologising for what it is not. */
    outOfScope:
      "I only work on the page in front of you. Photograph the worksheet, or tell me what is happening as your child works on it.",
    /* No model configured. Distinct from a limit and from a failure, and it
       says what still works rather than stopping at the bad news. */
    unavailable:
      "This deployment is not set up to reply in words yet, so nothing was sent to a model. The questions on the card above still work.",
    /* Used when we could not reply at all. The parent's eyes are at the
       composer, and the question they need may have scrolled away, so it comes
       back down to them rather than being pointed at. */
    fallbackAsk: "The question on your card above still stands:",
    watchForLabel: "Listen for:",
    suggestions: [
      "she's getting frustrated",
      "she got it but I don't think she understands",
      "what should I not say",
    ],
  },

  login: {
    heading: "Sign in",
    help: "We email you a link. There is no password to forget, and nothing for your child to sign into.",
    emailLabel: "Your email",
    submit: "Email me a link",
    sent: "Check your email. The link works once and lasts fifteen minutes.",
    sentQuiet: "If that address has been used here before, the link will open the same profile.",
    unconfigured:
      "This deployment cannot send email yet, so the link was written to the server log instead. An operator can retrieve it.",
    failed: "We could not send that email. Try again in a minute.",
    invalid: "That link is not valid. Ask for a new one.",
    expired: "That link has expired. Ask for a new one.",
    used: "That link has already been used. Ask for a new one.",
    anonymousNote:
      "You do not need an account. The demo and a single worksheet work without one; signing in is what keeps your history.",

    emailSubject: "Your ParentPilot sign-in link",
    emailBody: "Here is your sign-in link. It works once and lasts fifteen minutes.",
    emailLinkLabel: "Sign in to ParentPilot",
    emailFooter: "If you did not ask for this, you can ignore it. Nothing was created.",
  },

  account: {
    setupLink: "Add or change a child",
    heading: "Your account",
    signedInAs: "Signed in as",
    anonymous: "You are not signed in. Everything still works; nothing is kept beyond this browser.",
    signIn: "Sign in",
    signOut: "Sign out",
    childrenHeading: "Children",
    noChildren: "No child profile yet. Setup creates one.",
    childNote: "A profile, not an account. There is nothing here for a child to sign into.",
    preferencesHeading: "How I write to you",
  },

  history: {
    heading: "Past sessions",
    empty: "No sessions yet. They appear here once you have used Live Mode.",
    anonymous: "Sign in to keep your history across devices.",
    ratioLabel: "Autonomy",
    problemsLabel: "Problems worked",
    shareLabel: "Share with a teacher",
    shareCreate: "Create a link",
    shareCopy: "Copy the link",
    shareCopied: "Copied",
    shareRevoke: "Revoke",
    shareRevoked: "Revoked. The link no longer opens.",
    shareExpires: "Expires",
    openRecap: "Open the recap",
  },

  shared: {
    heading: "A homework session",
    explainer:
      "This is a read-only summary a parent chose to share with you. It shows what was worked on and what kind of things were said, never the words themselves. Nothing here was recorded.",
    problemsHeading: "What was worked on",
    errorHeading: "Where it got stuck",
    ratioHeading: "How the help was balanced",
    noteHeading: "The note the parent drafted",
    expired: "This link has expired.",
    unknown: "This link does not open anything.",
  },

  studio: {
    heading: "What you can make from this session",
    help: "Each of these is built from the session, on request. Nothing is generated until you ask.",
    teacherNote: "A note for the teacher",
    audioPrimer: "Listen to the primer",
    shareLink: "A read-only link",
  },

  audio: {
    play: "Listen to this",
    loading: "Preparing the audio",
    playing: "Playing",
    pause: "Pause",
    unavailable: "Audio is not available in this deployment.",
    help: "The same explanation, read aloud, for when reading is the hard part.",
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
