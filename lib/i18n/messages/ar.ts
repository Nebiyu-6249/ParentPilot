import type { LocaleOverlay } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/numbers";

/**
 * Arabic.
 *
 * Modern Standard Arabic at the register of a good school newsletter: plain,
 * warm, nothing classical. The English copy's voice is a particular kind of
 * understatement, and reproducing that construction by construction in Arabic
 * would produce something correct and cold. What is reproduced is the stance,
 * an informed friend at the table, not the sentence shapes.
 *
 * Choices a reviewer should know were deliberate.
 *
 * The parent is addressed as feminine singular (أنتِ), because the person
 * sitting with the homework at eight in the evening is statistically the
 * mother and Arabic has no neutral second person. Every such choice is wrong
 * for somebody; a masculine default would be wrong for more people here. The
 * strings are all in one file, so a deployment that knows better can flip it.
 *
 * The child is referred to as ابنتك, matching the saved example, and the
 * sentences that do not need a gendered child are written so they do not have
 * one.
 *
 * Punctuation is Arabic: ، for the comma, ؟ for the question mark, ؛ for the
 * semicolon. Latin punctuation inside Arabic text is the clearest sign of a
 * translation nobody read back.
 *
 * Numbers are Eastern Arabic-Indic, per the profile in locales.ts, and are
 * rendered through formatNumber rather than typed as literals, so a
 * deployment that switches the profile to Western digits gets them here too.
 * Mathematical expressions inside copy stay as expressions.
 *
 * NOT YET REVIEWED BY A NATIVE SPEAKER. See docs/i18n.md.
 */
export const ar: LocaleOverlay = {
  capture: {
    heading: "أرينـي الورقة",
    help: "صورة للصفحة، بما كتبته ابنتك عليها. ما كتبته هو الجزء المفيد.",
    photoLabel: "التقطي صورة أو اختاري واحدة",
    textLabel: "أو اكتبي المسألة",
    textPlaceholder: "مثال: 1/4 + 2/3 =",
    childWorkLabel: "ما كتبته ابنتك حتى الآن (اختياري)",
    submitPhoto: "اقرأ هذه الورقة",
    submitText: "استخدم هذه المسألة",
    sizeLimit: "صور فقط، حتى 6 ميغابايت، صفحة واحدة في كل مرة.",
    tooLarge: "هذه الصورة تتجاوز 6 ميغابايت. صورة أصغر تُقرأ بنفس الوضوح.",
    wrongType: "هذا الملف ليس صورة. صورة للصفحة هي الأفضل.",
  },

  status: {
    reading: "أقرأ ما كتبته",
    checking: "أتحقق من الحساب",
    matching: "أبحث عن الطريقة التي يدرّسونها في الصف",
    writing: "أكتب لكِ الشرح",
    almost: "أوشكت",
    thinking: "أقرأ المحادثة",
  },

  transcription: {
    heading: "هذا ما قرأته",
    help: "راجعيه قبل أن أكتب أي شيء. إن كنت قد أخطأت في قراءة سطر، صححيه الآن ويصح كل ما بعده.",
    printedLabel: "نص السؤال",
    workLabel: "ما كتبته ابنتك",
    answerLabel: "الناتج الذي كتبته",
    edit: "تعديل",
    save: "حفظ ومتابعة",
    lowConfidence: "لا أقرأ هذا السطر بوضوح. هل تكتبينه لي؟",
    confirm: "صحيح، تابع",
  },

  cards: {
    ANXIETY_STATEMENT:
      "هذه الجملة تحديدًا هي التي تنتقل، بحسب الأبحاث. جرّبي: هذه صعبة، هيا نحلها معًا.",
    GENERIC_PRAISE: "سمّي ما فعلته: راجعتِ الناتج قبل أن تنتقلي، وهذا هو المهم.",
    TAKES_OVER: "تتحدثين منذ أربعين ثانية. اسألي شيئًا ثم انتظري.",
    ESCALATION: "توقفي عشرين ثانية. اشربي كوب ماء. لا شيء يضيع.",
    PRODUCTIVE_WAIT: "دعيها تفكر. هذا الصمت هو العمل نفسه.",
  },

  register: {
    heading: "كيف أكتب لكِ",
    options: [
      { value: "PLAIN", label: "أبسط" },
      { value: "STANDARD", label: "عادي" },
      { value: "TECHNICAL", label: "أكثر تخصصًا" },
    ],
  },

  provenance: {
    fixture: "هذا مثال محفوظ، وليس قراءة لورقتك.",
    generic:
      "لم يستجب النموذج، فهذا هو الشرح العام المحفوظ لهذا الموضوع، لا شرح مكتوب انطلاقًا مما كتبته ابنتك.",
  },

  limits: {
    banner: "انتهى حد التجربة لهذا اليوم. نعرض مثالًا محفوظًا.",
    spendBanner: "بلغنا سقف الإنفاق لهذا اليوم. نعرض مثالًا محفوظًا بدل رسالة خطأ.",
    demoBanner: "هذا مثال محفوظ.",
    unconfiguredBanner: "هذا التنصيب لا يقرأ أوراقًا جديدة بعد، فهذا مثال محفوظ.",
    curriculumFallback:
      "منهج ابنتك ({theirs}) غير محمّل بعد، فقد طوبق هذا مع معيار من {ours}. الطريقة والأسئلة تبقى صالحة؛ أما الرمز والصف فقد لا يكونان كذلك.",
  },

  errors: {
    modelTimeout: "تأخر النموذج مرتين، فهذا هو الشرح العام المحفوظ لهذا الموضوع.",
    malformed: "أرسل النموذج شيئًا لم نستطع قراءته، فهذا هو الشرح العام المحفوظ لهذا الموضوع.",
    noProblem: "لم تعطنا هذه الورقة مسألة نستطيع قراءتها. صورة أقرب وأكثر استواءً تحل هذا عادة.",
    notFound: "هذه الصفحة غير موجودة.",
    generic: "حدث خلل عندنا. لم يضع شيء من عملك.",
  },

  common: {
    back: "رجوع",
    cancel: "إلغاء",
    continue: "متابعة",
    loading: "جارٍ العمل",
    backToThread: "العودة إلى المحادثة",
    kindergarten: "الروضة",
    gradeUnknown: "الصف غير محدد",
  },

  setup: {
    heading: "أربعة أسئلة سريعة",
    subheading: "تستغرق دقيقة وتغيّر كل ما سترينه بعدها.",
    step1: {
      heading: "أي هذه الصيغ أقرب إليكِ؟",
      help: "لا توجد إجابة صحيحة. اختاري ما تحبين قراءته في الثامنة مساءً.",
    },
    step2: {
      heading: "كيف كانت الرياضيات معك في المدرسة؟",
      help: "هذا لا يُعرض عليك أبدًا كدرجة. يغيّر فقط عدد مرات تدخّل الوضع المباشر.",
      options: [
        { band: 1, label: "كنت أحبها" },
        { band: 2, label: "لا بأس، لكني نسيت معظمها" },
        { band: 3, label: "كنت أمرّ بها، دون أن أستمتع" },
        { band: 4, label: "كانت تجربة سيئة فعلًا" },
      ],
    },
    step3: {
      heading: "عن ابنتك",
      help: "الاسم اختياري. نستعمله فقط داخل الجُمل التي نكتبها لكِ.",
      gradeLabel: "الصف",
      nameLabel: "الاسم الأول (اختياري)",
      curriculumLabel: "المنهج",
      schoolLanguageLabel: "لغة الورقة",
      schoolLanguageSame: "نفس اللغة التي أحدثك بها",
      schoolLanguageHelp:
        "إن كانت ابنتك تدرس بلغة غير التي تقرئين بها بارتياح، فقولي ذلك هنا. أشرح لكِ بلغتك وأعطيك الكلمات التي ستسمعها في الصف.",
      subjectsLabel: "المواد",
    },
    step4: {
      heading: "بأي لغة تريدين أن أحدثك؟",
      help: "هذه لغة الشرح والجُمل التي أعطيك إياها. وهي غير لغة الورقة نفسها.",
    },
    finish: "تم، خذني إلى الورقة",
    next: "التالي",
    back: "رجوع",
  },

  packet: {
    primerHeading: "ما الذي يُدرَّس هنا فعلًا",
    methodHeading: "طريقتك وطريقتهم",
    yourMethodLabel: "الطريقة التي تعلمتِها",
    schoolMethodLabel: "الطريقة التي يتبعها الصف",
    bothCorrect: "كلتاهما صحيحة. الصف يريد الثانية لأنها تُظهر التفكير.",
    hintHeading: "خمسة أسئلة، بالترتيب",
    hintHelp: "اسألي واحدًا. انتظري. لا تنتقلي إلى التالي إلا إذا لم يثمر الانتظار.",
    hintReveal: "أظهر السؤال التالي",
    hintDone: "هذه كل الأسئلة الخمسة.",
    answerHeading: "الناتج",
    answerHold: "اضغطي مع الاستمرار لإظهاره",
    answerHolding: "واصلي الضغط",
    answerWhy:
      "هو خلف ضغطة مستمرة لأن الوصول إليه هو الشيء السهل، وهو تحديدًا ما ينهي التعلّم.",
    verifiedBadge: "مُتحقَّق منه",
    unverifiedBadge: "غير متحقَّق",
    verifiedHelp: "أعدنا حسابه بالبرمجة، بمعزل عن النموذج، فاتفق الاثنان.",
    unverifiedHelp:
      "لم يتطابق حسابنا مع النموذج، فلا نعرض ناتجًا. الأسئلة أعلاه تبقى سليمة.",
    scriptsHeading: "ما يُقال وما يُترك",
    scriptAvoid: "اتركي",
    scriptUse: "جرّبي",
    isomorphHeading: "ثلاث مسائل مثلها",
    isomorphHelp: "الفكرة نفسها بأرقام أخرى. استعمليها بعد أن تترسخ الأولى.",
    misconceptionHeading: "أين الخلل",
    misconceptionRepair: "السؤال الذي يصححه",

    askLabel: "اسألي هذا ثم انتظري",
    rungCounter: (n: number, total: number): string =>
      `السؤال ${formatNumber(n, "ar")} من ${formatNumber(total, "ar")}`,
    stillStuck: "ما زالت متوقفة",
    answeredIt: "وصلت إليه",
    ladderExhausted:
      "كان هذا آخرها. إن لم تصل بعد، فالناتج في أسفل الشاشة، والتوقف هنا نهاية جيدة تمامًا.",

    solvedHeading: "جيد. انتهت هذه.",
    solvedBody: "وصلت إليها بإجابة سؤال لا بأن أحدًا أخبرها، وهذا هو الجزء الذي يبقى.",
    solvedAgain: "العودة إلى الأسئلة",

    discloseWhy: "لماذا أخطأت",
    discloseMethods: "أرني الطريقتين",
    discloseTeaching: "ما الذي تعلّمه هذه المسألة؟",
    discloseScripts: "ما يُقال وما يُترك",
    discloseAnswer: "أخبرني بالناتج فقط",
    standardClosest: "الأقرب:",
    standardUncertainHelp:
      "لم يكن البحث واثقًا من هذا، فاعتبريه أقرب ما وجدناه لا ما تعمل عليه ابنتك في الصف بالتأكيد. الطريقة والأسئلة أعلاه لا تعتمد عليه.",
    primerMore: "اقرئي الشرح كاملًا",
    genericFallback:
      "لم أستطع كتابة شرح جديد لهذه، فهذا هو الشرح العام المحفوظ للموضوع. هو صحيح لكنه غير مبني على ما كتبته ابنتك.",
  },

  voice: {
    hold: "اضغطي مع الاستمرار للتحدث",
    holding: "أستمع، ارفعي إصبعك للإرسال",
    thinking: "أفكّر بما أقول",
    speaking: "أتحدث",
    stop: "إيقاف",
    activeVoice: "وضع الصوت. أجيبك بصوت مسموع.",
    activeLive: "الوضع المباشر. أستمع وأرشدك، ولا أجيب.",
    keepListening: "أبقي المايكروفون مفتوحًا بعد إجابتي",
    keepListeningHelp: "يبقى مفتوحًا بضع ثوانٍ لتتابعي دون أن تمسكي الهاتف مرة أخرى.",
    childCanHear: "ابنتك تسمع هذا",
    childCanHearHelp:
      "عند التفعيل، لا أقول الناتج بصوت مسموع أبدًا، ولا أسمّي ما أخطأت فيه، ولا أستعمل اسمها. النسخة الكاملة تبقى على شاشتك، حيث تقرئينها وحدك.",
    childCanHearOffHelp:
      "عند الإيقاف، أستطيع أن أكون أوضح بصوت مسموع. الناتج يبقى خلف الضغطة المستمرة وحدها.",
    onScreen: "هو على شاشتك، خلف الضغطة المستمرة.",
    unconfigured: "هذا التنصيب لا يتحدث بعد. كل ما عداه يعمل.",
    limit: "بلغنا سقف الصوت لهذا اليوم. الكتابة ما زالت تعمل.",
    nothingHeard: "لم ألتقط ذلك. أبقي الزر مضغوطًا أثناء الكلام.",
    tooLong: "كان ذلك طويلًا. جرّبي في جملة أو جملتين.",
    failed: "لم يصل ذلك. قوليه مرة أخرى.",
    micDenied: "لم يمنحنا متصفحك المايكروفون. وضع الصوت يحتاجه.",
    unsupported: "هذا المتصفح لا يسجّل الصوت، فوضع الصوت متوقف. الكتابة تعمل.",
  },

  live: {
    heading: "الوضع المباشر",
    intro:
      "أستمع بينما تعملان معًا. الصوت يبقى في متصفحك، لا يُرفع ولا يُحفظ. أحتفظ فقط بنوع ما قيل ووقته.",
    micPrompt: "ابدئي الاستماع",
    micDenied: "لم يمنحنا متصفحك الميكروفون. الوضع المباشر يحتاجه، ولا شيء غيره يحتاجه.",
    unsupported:
      "هذا المتصفح لا يتعرف على الكلام داخل الصفحة، فسنرسل مقاطع صوتية قصيرة لتفريغها. تُفرَّغ ثم تُحذف، ولا تُحفظ أبدًا.",
    stop: "إنهاء الجلسة",
    listening: "أستمع",
    cardDismiss: "فهمت",
    parkHeading: "اتركيها هنا",
    parkBody:
      "هذه طالت بما يكفي. توقفي. لا شيء يضيع بتركها، والملاحظة أدناه تخبر المعلمة أين وصلتما بالضبط.",
    parkNoteHeading: "ملاحظة للمعلمة",
    parkCopy: "نسخ الملاحظة",
    parkCopied: "نُسخت",
    cardsSpent: "هذا آخر ما سأقاطعك به في هذه الجلسة.",

    startShort: "استمعي بينما نعمل",
    stopShort: "أوقفي الاستماع",
    listeningInThread: "أستمع. الصوت يبقى في هذا المتصفح.",
    nothingRecorded: "لم يُسجَّل شيء من تلك الفترة، فلا شيء نلخصه. المرافقة حدثت فعلًا.",
    summaryFailed: "لم أستطع تجميع ملخص تلك الفترة.",
    summaryHeading: "كيف مضت تلك الفترة",
    summaryProvenance: "مكتوب من تلك الأعداد وحدها. لم يُحفظ تسجيل ولم تُخزَّن كلمات.",
  },

  check: {
    heading: "مراجعة العمل المنتهي",
    help: "أخبرك بنوع الخطأ الموجود. لا أعطيك النواتج ولا أصحح لكِ الورقة.",
    submit: "انظر في هذا",
    resultHeading: "ما أراه",
    clean: "لا شيء هنا يبدو سوء فهم. الحل متماسك.",
    noAnswers: "هذه الشاشة لا تعرض نواتج أبدًا، عن قصد. هذا هو معناها.",
  },

  recap: {
    heading: "كيف مضت",
    ratioLabel: "دعم الاستقلال",
    ratioHelp:
      "الأسئلة المطروحة والثناء المحدد ووقت الانتظار، مقابل النواتج المعطاة والثناء العام والنقد وتولّي الحل. كلما ارتفع، فكّرت ابنتك أكثر.",
    movesHeading: "ماذا حدث",
    noMoves: "لم يُصنَّف شيء في هذه الجلسة، فلا شيء نذكره.",
    again: "العودة إلى الورقة",
  },

  settings: {
    heading: "الإعدادات",
    registerHeading: "كيف أكتب لكِ",
    registerHelp: "يغيّر كل كلمة على الشاشة التي تنظرين إليها. لا يعيد تحميل الصفحة.",
    languageHeading: "اللغة",
    anxietyHeading: "كم مرة يتدخل الوضع المباشر",
    exportHeading: "بياناتك",
    exportButton: "تصدير كل شيء بصيغة JSON",
    deleteButton: "حذف كل شيء",
    deleteConfirm:
      "هذا يحذف ملفك وملفات أبنائك وكل ورقة وكل جلسة. لا يمكن التراجع. اكتبي DELETE للتأكيد.",
    deleted: "حُذف. لم يبق شيء من بياناتك عندنا.",
  },

  chat: {
    emptyIntent: "أريني الورقة وأخبرك بما تسألين.",
    emptyPhoto: "التقطي صورة للصفحة",
    emptyDemo: "أو شاهديه يعمل على ورقة محفوظة",
    emptyDemoWork: "جمعت المقامات وكتبت 3/7.",
    emptyDemoNote: "بلا صورة، بلا حساب، بلا تكلفة.",
    demoTurn: "شغّل الورقة المحفوظة.",
    photoTurn: "هذه هي الورقة.",
    placeholder: "أخبريني بما يحدث",
    note: "ParentPilot يحدثك أنتِ، ولا يحدث ابنتك أبدًا.",
    newThread: "ورقة جديدة",
    threadsToday: "اليوم",
    threadsWeek: "هذا الأسبوع",
    threadsEarlier: "قبل ذلك",
    turnUnconfigured:
      "هذا التنصيب لا يستطيع الرد على ما تكتبينه بعد. اضغطي ما زالت متوقفة للسؤال التالي، أو صوّري الصفحة التالية.",
    turnLimit: "بلغنا سقف الردود لهذا اليوم. ما زالت متوقفة والمثال المحفوظ يعملان.",
    turnFailed: "لم يصل ذلك. قوليه مرة أخرى.",
    answerBehindHold: "هو هنا، خلف الضغطة المستمرة.",
    nextQuestion: "هذا هو السؤال التالي.",

    exampleLabel: "محلولة بأرقام أخرى",
    avoidLabel: "يُستحسن ألا يُقال:",
    explainerMore: "أكثر قليلًا",
    explainerLess: "أقل",
    explainerChild: "قوليها لابنة تسع سنوات",
    explainerAdult: "العودة إلى النص الكامل",
    chipsLabel: "بعد ذلك",
    copyTurn: "نسخ",
    copiedTurn: "نُسخ",
    jumpToLatest: "الانتقال إلى الأحدث",
    suggestions: ["بدأت تتوتر", "وصلت للحل لكني لا أظنها فهمت", "ما الذي يُستحسن ألا أقوله"],

    share: "مشاركة",
    shareHeading: "أرسلي هذا إلى المعلمة",
    shareHelp:
      "ملاحظة قصيرة بكلماتك، مبنية على ما حدث الليلة. اقرئيها، غيّري ما شئت، ثم أرسليها بنفسك.",
    shareDrafting: "أكتب الملاحظة",
    shareCopy: "نسخ الملاحظة",
    shareCopied: "نُسخت",
    shareClose: "إغلاق",
    shareFooter: "لا نرسل شيئًا نيابة عنك ولا نحفظ شيئًا. الملاحظة موجودة في هذه النافذة فقط.",
    shareEmpty: "صوّري ورقة أولًا. لا يوجد بعد ما يُقال لمعلمة.",
    shareUnconfigured: "هذا التنصيب لا يكتب ملاحظات بعد. كل ما عداه في المحادثة يعمل.",
    shareLimit: "بلغنا سقف الكتابة لهذا اليوم. المحادثة غير متأثرة.",
    shareFailed: "تعذّرت كتابة الملاحظة الآن. جرّبي بعد دقيقة.",
  },

  login: {
    heading: "تسجيل الدخول",
    help: "نرسل لكِ رابطًا بالبريد. لا كلمة مرور تُنسى، ولا شيء تدخل إليه ابنتك.",
    emailLabel: "بريدك الإلكتروني",
    submit: "أرسلي لي رابطًا",
    sent: "راجعي بريدك. الرابط يعمل مرة واحدة ويبقى خمس عشرة دقيقة.",
    sentQuiet: "إن كان هذا العنوان قد استُعمل هنا من قبل، فسيفتح الرابط الملف نفسه.",
    unconfigured:
      "هذا التنصيب لا يرسل بريدًا بعد، فكُتب الرابط في سجل الخادم. يستطيع المشغّل استخراجه.",
    failed: "لم نستطع إرسال البريد. جرّبي بعد دقيقة.",
    invalid: "هذا الرابط غير صالح. اطلبي رابطًا جديدًا.",
    expired: "انتهت صلاحية الرابط. اطلبي رابطًا جديدًا.",
    used: "استُعمل هذا الرابط من قبل. اطلبي رابطًا جديدًا.",
    anonymousNote:
      "لا تحتاجين حسابًا. التجربة وورقة واحدة تعملان بدونه؛ تسجيل الدخول هو ما يحفظ سجلك.",

    emailSubject: "رابط الدخول إلى ParentPilot",
    emailBody: "هذا رابط الدخول. يعمل مرة واحدة ويبقى خمس عشرة دقيقة.",
    emailLinkLabel: "ادخلي إلى ParentPilot",
    emailFooter: "إن لم تطلبي هذا، تجاهليه. لم يُنشأ شيء.",
  },

  account: {
    heading: "حسابك",
    signedInAs: "مسجّلة الدخول باسم",
    anonymous: "لم تسجلي الدخول. كل شيء يعمل؛ ولا يُحفظ شيء خارج هذا المتصفح.",
    signIn: "تسجيل الدخول",
    signOut: "تسجيل الخروج",
    childrenHeading: "الأبناء",
    noChildren: "لا يوجد ملف بعد. الإعداد ينشئ واحدًا.",
    childNote: "ملف، لا حساب. لا يوجد هنا شيء يسجل طفل الدخول إليه.",
    preferencesHeading: "كيف أكتب لكِ",
  },

  history: {
    heading: "الجلسات السابقة",
    empty: "لا جلسات بعد. تظهر هنا بعد استعمال الوضع المباشر.",
    anonymous: "سجّلي الدخول للاحتفاظ بسجلك عبر أجهزتك.",
    ratioLabel: "الاستقلال",
    problemsLabel: "المسائل التي عُمل عليها",
    shareLabel: "المشاركة مع معلمة",
    shareCreate: "أنشئي رابطًا",
    shareCopy: "نسخ الرابط",
    shareCopied: "نُسخ",
    shareRevoke: "إبطال",
    shareRevoked: "أُبطل. لم يعد الرابط يفتح شيئًا.",
    shareExpires: "ينتهي في",
    openRecap: "افتحي الملخص",
  },

  shared: {
    heading: "جلسة واجبات",
    explainer:
      "هذا ملخص للقراءة فقط اختار أحد الوالدين مشاركته معك. يعرض ما عُمل عليه ونوع ما قيل، لا الكلمات نفسها. لم يُسجَّل شيء هنا.",
    problemsHeading: "ما عُمل عليه",
    errorHeading: "أين توقف",
    ratioHeading: "كيف توزعت المساعدة",
    noteHeading: "الملاحظة التي كتبها ولي الأمر",
    expired: "انتهت صلاحية هذا الرابط.",
    unknown: "هذا الرابط لا يفتح شيئًا.",
  },

  audio: {
    play: "استمعي إلى هذا",
    loading: "أجهّز الصوت",
    playing: "قيد التشغيل",
    pause: "إيقاف مؤقت",
    unavailable: "الصوت غير متاح في هذا التنصيب.",
    help: "الشرح نفسه، مقروءًا بصوت عالٍ، لحين يكون القراءة هو الجزء الصعب.",
  },
};
