/**
 * Every user-facing string in ParentPilot, in English.
 *
 * The canonical catalogue. Other locales in this directory are overlays: they
 * carry the sections they translate and inherit the rest from here, so a
 * string added in English is never silently missing elsewhere, it is visibly
 * English until someone writes it.
 *
 * Deliberately not `as const`. The literal types that gives are worth having
 * for an enum and actively harmful for copy: an overlay would have to match
 * the English string exactly rather than replace it. Widened strings are the
 * point.
 *
 * The English copy is also the only copy the marketing site has. That is a
 * launch decision rather than an oversight: the pages under app/(site) are
 * argument-shaped prose where a weak translation costs more credibility than
 * it buys, so a parent arriving in Arabic gets the product in Arabic and the
 * pitch in English until those pages are written properly.
 */

import type { RegisterName } from "@/lib/ai/schemas";

export const en = {
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
    /* The header sells; the footer is utility. Live Mode left the header when
       it became a control in the composer rather than a place to go. */
    howItWorks: "How it works",
    research: "Research",
    forTeachers: "For teachers",
    open: "Open ParentPilot",
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

  /**
   * The three marketing pages.
   *
   * Written to be read by someone deciding whether to trust this with a
   * photograph of their child's work, and by a teacher deciding whether to
   * recommend it. Nothing here is a claim the product does not keep.
   */
  howItWorks: {
    title: "How it works",
    description:
      "Photograph the worksheet. ParentPilot reads the working, checks the arithmetic in code, and hands you the question to ask. It never speaks to your child.",
    heading: "One photograph, then a question to ask",
    intro:
      "The loop is short on purpose. A parent standing at a kitchen table at eight in the evening has about a minute of patience, and every step below has to earn its place inside it.",

    steps: [
      {
        n: "01",
        title: "Photograph the page, working and all",
        body: "The child's attempt is the useful part. A correct answer tells you nothing about what they understand, and a wrong one tells you almost everything, but only if you can read the route they took to it.",
        note: "Metadata is stripped from the photo before it leaves your phone. A picture of a worksheet otherwise carries the coordinates of your kitchen.",
      },
      {
        n: "02",
        title: "The arithmetic is checked in code, not guessed",
        body: "The sum is recomputed here with exact fractions, so a quarter plus two thirds is eleven twelfths and not a rounding error. If our answer and the model's disagree, the answer is removed from the page rather than shown with a caveat.",
        note: "That is what the Checked badge means. It is a claim about arithmetic, made by arithmetic.",
      },
      {
        n: "03",
        title: "The misunderstanding gets a name",
        body: "Adding the denominators is not a slip, it is a theory: that a fraction is two numbers rather than one quantity. Twenty of the most common theories are written down here, and three of them are detected in code before a model is asked anything.",
        note: "If nothing on the list genuinely fits, you are told nothing fits. A confident wrong diagnosis is worse than an admitted gap.",
      },
      {
        n: "04",
        title: "You get the question, not the explanation",
        body: "Five questions in escalating order, the first barely a nudge. You ask one and wait. The waiting is the part that works, and it is the part almost everybody skips.",
        note: "The answer exists, behind a press and hold. It is the furthest thing on the screen from your thumb, deliberately.",
      },
      {
        n: "05",
        title: "Live Mode listens, and mostly says nothing",
        body: "Turn the microphone on and it notices the three things that undo a homework session: giving the answer, praise with no content in it, and a voice starting to rise. It will interrupt you at most three times in a sitting.",
        note: "The audio never leaves your browser. What is kept is a label and a timestamp, never a word that was said.",
      },
    ],

    notHeading: "What it will not do",
    not: [
      "Talk to your child. There is no child account, no child login, and no screen a child is meant to read.",
      "Do the homework. The answer is one press away and it is the only thing on the page we would rather you did not reach for.",
      "Keep a recording. There is no column in the database that could hold one.",
      "Teach anything but maths, for now. Ask it about spelling and it will say so.",
    ],

    ctaHeading: "See it run on a worksheet",
    ctaBody: "The saved example runs the whole loop with no photo, no account and no cost.",
    cta: "Try it",
  },

  research: {
    title: "Research",
    description:
      "Parental homework help correlates with worse maths outcomes, and the mechanism is known. ParentPilot is built around the four findings that explain it.",
    heading: "Why this is built the way it is",
    intro:
      "Helping a child with maths homework, as it is usually done, is associated with worse outcomes rather than better ones. That is an uncomfortable finding and it is the reason this product exists in the shape it does. The mechanism is not effort, it is style.",

    thesisHeading: "The one-sentence version",
    thesis:
      "Route the help to the adult, change how the adult helps, and the thing that was making it worse stops.",

    findingsHeading: "What the evidence says",
    findings: [
      {
        claim:
          "Parents who are anxious about maths pass that anxiety to their children, and only when they help with homework.",
        why: "This is the finding that decides who the product speaks to. The transmission happens through the helping, so the intervention has to change the helping rather than add to it.",
        source: "Maloney, Ramirez, Gunderson, Levine and Beilock, Psychological Science, 2015",
      },
      {
        claim:
          "Praise aimed at effort and strategy sustains persistence. Praise aimed at the person does not.",
        why: "Live Mode raises a card on generic praise for this reason, and the card does not scold: it offers the specific sentence to use instead.",
        source: "Gunderson et al., Child Development, 2013",
      },
      {
        claim:
          "Autonomy-supportive help produces better learning than help that takes over the task.",
        why: "The whole hint ladder is a device for staying autonomy-supportive under pressure. Each rung hands the thinking back rather than moving it along.",
        source: "Grolnick and Ryan, Journal of Personality and Social Psychology, 1989",
      },
      {
        claim:
          "Waiting three seconds or more after asking a question measurably lengthens and improves the answer.",
        why: "Every question the product gives you is followed by the same instruction: ask this, then wait. Silence is the single cheapest intervention in the literature and the hardest one to actually do.",
        source: "Rowe, Journal of Teacher Education, 1986",
      },
    ],

    aiHeading: "Two findings about AI specifically",
    aiIntro:
      "These two set the shape of the product rather than the content of its advice. They are the reason the model talks to you and not to your child.",
    ai: [
      {
        claim:
          "AI coaching lifts the least expert helper the most, by increasing probing questions and reducing generic praise.",
        why: "This is the mechanism ParentPilot is copying, pointed at a parent instead of a tutor. It is also why the coaching is about how you help rather than about the mathematics.",
        source: "Tutor CoPilot, a randomised controlled trial, Stanford",
      },
      {
        claim:
          "Students given unguarded access to GPT-4 as a tutor did 17 percent worse than a no-AI control once the tool was taken away.",
        why: "Routing the model to the adult makes that failure mode structurally impossible. There is nothing here for a child to become dependent on, because there is nothing here a child can open.",
        source: "Bastani et al.",
      },
    ],

    honestHeading: "What this does not prove",
    honest:
      "None of this is evidence that ParentPilot works. It is the reasoning the product is built from, not a result it has produced. No trial of this app has been run, no outcome has been measured, and anyone telling you a homework app has proven learning gains after a few months of existing is selling something. What can be said is narrower and true: the behaviours it coaches are ones the literature associates with better outcomes, and the failure mode it designs out is one that has been measured.",

    citationNote:
      "Sources are listed so they can be checked rather than taken on trust. Where a citation here is less complete than the others, that is because it is reported as it reached us, and it is better to say so than to invent a volume number.",
  },

  forTeachers: {
    title: "For teachers",
    description:
      "ParentPilot coaches the parent, never the child. It sends you a note about where homework stopped, and it never shows a child an answer.",
    heading: "It coaches the parent, and it stops where you would want it to",
    intro:
      "You have almost certainly seen homework come back that a parent did. This is built to make that less likely, not more.",

    pointsHeading: "What it does to a homework sitting",
    points: [
      {
        title: "It never speaks to the child",
        body: "There is no child account and no screen a child is meant to read. The parent reads a question and asks it in their own voice. If you have a family where the parent's English is the limiting factor, the primer can be read aloud to them in their language while the child hears their parent speak in theirs.",
      },
      {
        title: "It teaches your method, not the parent's",
        body: "The commonest cause of a bad homework evening is a parent teaching the algorithm they learned in 1994 over the top of the one you taught on Tuesday. Method Match shows both side by side, marks both correct, and says plainly why the class is doing it your way.",
      },
      {
        title: "It stops, and it tells you where",
        body: "Twenty minutes on one question, or a second flash of temper, and it says park it. The parent gets a short note they can send you saying what was attempted and where it stopped. You get a signal you would otherwise never see.",
      },
      {
        title: "The answer is deliberately awkward to reach",
        body: "It exists, because a parent at half past nine sometimes needs it, and pretending otherwise just sends them to a search engine that will show it to the child too. It sits behind a press and hold at the bottom of the screen, and the product never states it in prose.",
      },
    ],

    privacyHeading: "What we keep about your students",
    privacyBody:
      "A first name, only if the parent types one, and a grade. No email, no password, no login. Live Mode's audio never leaves the parent's browser and there is no column in our database that could hold a transcript. What is stored from a session is a list of labels and timestamps describing what the parent did.",

    shareHeading: "The note you might receive",
    shareBody:
      "It is drafted by the product and sent by the parent, in their words, after they have read and edited it. Nothing is sent automatically and nothing is published. A parent can also share a read-only summary of a session, which expires after thirty days and which they can revoke.",

    ctaHeading: "Look at what a parent sees",
    ctaBody: "The saved example is the whole loop, with no account and nothing to install.",
    cta: "Open the example",
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
      /* Separate from step 4, which asks what language to talk to the parent
         in. This asks what language the worksheet is written in, and they are
         different questions far more often than an English-first product
         assumes. */
      schoolLanguageLabel: "The language of the worksheet",
      schoolLanguageSame: "Same as the language you talk to me in",
      schoolLanguageHelp:
        "If your child is taught in a different language from the one you read most comfortably, say so here. I will explain in yours and give you the words they will hear in class.",
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
    /* A typed turn reads the thread rather than the page, and saying
       "Reading her working" while doing that would be a small lie. */
    thinking: "Reading the thread",
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

  /* Voice Mode.
   *
   * Kept apart from `live` in the catalogue as well as on screen, because the
   * one thing this feature must never be is confusable with Live Mode. One
   * listens to a conversation and coaches; the other answers a question out
   * loud. A parent who mixes them up either thinks they are being recorded
   * when they are not, or speaks to a microphone that is only classifying. */
  voice: {
    /* The control. Press and hold, so the label says so: a tap does nothing
       and a label that implied otherwise would be the first thing to break
       trust in it. */
    hold: "Hold to talk",
    holding: "Listening, let go to send",
    thinking: "Working out what to say",
    speaking: "Speaking",
    stop: "Stop",

    /* The indicator names the mode in words. Two mic-shaped controls on one
       composer is exactly the situation where an icon is not enough. */
    activeVoice: "Voice Mode. I answer out loud.",
    activeLive: "Live Mode. I listen and coach, I do not answer.",

    keepListening: "Keep the mic open after I answer",
    keepListeningHelp:
      "Leaves it open for a few seconds so you can follow up without reaching for the phone again.",

    /* Default on, and the help text says what it changes rather than what it
       is called. */
    childCanHear: "She can hear this",
    childCanHearHelp:
      "On, I never say the answer out loud, never name what she got wrong, and never use her name. The full version stays on your screen, where only you read it.",
    childCanHearOffHelp:
      "Off, I can be franker out loud. The answer still only comes from the press and hold.",

    /* The fixed line. Said when the parent asks for the answer aloud, and
       substituted whenever a rendering fails its check. Short on purpose:
       anything longer is talking its way towards the number. */
    onScreen: "It is on your screen, behind the hold.",

    unconfigured: "This deployment cannot speak yet. Everything else works.",
    limit: "We have hit today's ceiling on speech. Typing still works.",
    nothingHeard: "I did not catch that. Hold the button while you talk.",
    tooLong: "That was a long one. Try again in a sentence or two.",
    failed: "That did not come through. Try saying it again.",
    micDenied: "Your browser did not give us the microphone. Voice Mode needs it.",
    unsupported: "This browser cannot record audio, so Voice Mode is off. Typing works.",
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

    /* Live Mode is a toggle in the composer now, so it needs the short labels
       a control has rather than the long ones a screen had. */
    startShort: "Listen while we work",
    stopShort: "Stop listening",
    listeningInThread: "Listening. The audio stays in this browser.",
    /* A session that opened no row has nothing to summarise, and a summary of
       zero would look like a judgement rather than an absence. */
    nothingRecorded:
      "That stretch was not recorded, so there is nothing to summarise. The coaching still happened.",
    summaryFailed: "I could not put together the summary for that stretch.",
    summaryHeading: "How that stretch went",
    /* Said on the card itself, not only on the privacy page. The claim is
       easier to believe next to the numbers it was written from. */
    summaryProvenance:
      "Written from those counts alone. No recording was kept and no words were stored.",
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
    /* Annotated rather than widened with the rest of the file. `value` is an
       enum the control switches on, not copy, and losing the union here would
       let a typo in a translation compile. `label` stays a plain string so an
       overlay can replace it. */
    options: [
      { value: "PLAIN", label: "Simpler" },
      { value: "STANDARD", label: "Standard" },
      { value: "TECHNICAL", label: "More technical" },
    ] as { value: RegisterName; label: string }[],
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
    /* Free text needs a model, and a deployment without one says so rather
       than swallowing what a parent typed. The buttons still work, so the
       sentence names them. */
    turnUnconfigured:
      "This deployment cannot answer in your own words yet. Tap Still stuck for the next question, or photograph the next page.",
    turnLimit:
      "We have hit today's ceiling on replies. Still stuck and the saved example both still work.",
    turnFailed: "That did not go through. Try saying it again.",
    /* Said when the parent asks for the answer, and said again if a reply ever
       comes back with the answer inside it. The card below it does the
       revealing, behind the press and hold. */
    answerBehindHold: "It is here, behind the hold.",
    /* The thread's own turn label when a parent taps a suggestion chip rather
       than typing. */
    nextQuestion: "Here is the next one to try.",

    /* The three chat cards. Labels only: everything else on them is written
       per turn by the model. */
    exampleLabel: "Worked through on different numbers",
    avoidLabel: "Worth not saying:",
    explainerMore: "A bit more",
    explainerLess: "Less",
    explainerChild: "Say it to a nine year old",
    explainerAdult: "Back to the full version",
    /* The chips under an assistant turn. Tapping one is the same as typing it,
       so the label is what a parent would have typed. */
    chipsLabel: "Next",
    copyTurn: "Copy",
    copiedTurn: "Copied",
    jumpToLatest: "Jump to latest",
    suggestions: [
      "she's getting frustrated",
      "she got it but I don't think she understands",
      "what should I not say",
    ],

    /* The top bar. Two controls: how it writes to you, and sending this on to
       the teacher. Both apply to the whole thread rather than to one card,
       which is the reason they live up there and not inside it. */
    share: "Share",
    shareHeading: "Send this to the teacher",
    shareHelp:
      "A short note in your words, built from what happened tonight. Read it, change anything you like, then send it yourself.",
    shareDrafting: "Drafting the note",
    shareCopy: "Copy the note",
    shareCopied: "Copied",
    shareClose: "Close",
    /* The note is the parent's to send. We never send it for them, and we
       never publish it: a drafted note is not stored and never appears on a
       shared link. */
    shareFooter: "Nothing is sent for you and nothing is kept. The note exists in this window only.",
    shareEmpty: "Photograph a worksheet first. There is nothing to tell a teacher about yet.",
    /* Three situations that are not the same thing, so three sentences. The
       first two cannot be fixed by waiting a minute, and telling a parent to
       retry something that will not succeed is the kind of small lie this
       product does not tell. */
    shareUnconfigured:
      "This deployment is not set up to draft notes yet. Everything else in the thread still works.",
    shareLimit: "We have hit today's ceiling on drafting. The thread is unaffected.",
    shareFailed: "The note could not be drafted just now. Try again in a minute.",
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
    /* Shown when nothing in the child's curriculum matched and the search fell
       back to the whole corpus. Names both, because a parent who knows the
       match came from somebody else's syllabus can judge how much of it
       transfers. {theirs} and {ours} are substituted by lib/packet.ts. */
    curriculumFallback:
      "Your child's curriculum ({theirs}) is not loaded yet, so this was matched against a {ours} standard. The method and the questions still hold; the code and the year group may not.",
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
    /* Every settled screen on the product surface leads back to the one place
       a parent was actually working. */
    backToThread: "Back to the thread",
    kindergarten: "Kindergarten",
    /* Child.grade is nullable, so this is a state a parent can genuinely be
       in rather than a placeholder for missing data. It says what is true and
       does not nag. */
    gradeUnknown: "Grade not set",
  },
};
