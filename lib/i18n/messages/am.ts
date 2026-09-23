import type { LocaleOverlay } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/numbers";

/**
 * Amharic.
 *
 * Choices a reviewer should know were deliberate.
 *
 * The parent is addressed with the polite form (እርስዎ, verbs in -ዎ / -ው).
 * Amharic marks gender in the familiar second person and this product does
 * not know the parent's gender, so the familiar forms would mean guessing on
 * every sentence. The polite form is ungendered and is what an Ethiopian
 * service would use with an adult it has not met. It is slightly more formal
 * than the English voice and that is the right trade here.
 *
 * The child is ልጅዎ, "your child", which is ungendered, rather than a
 * gendered pronoun. The English copy says "she" because the saved example is
 * one girl; Amharic can simply avoid the question and does.
 *
 * Punctuation is Ethiopic: ። ends a sentence, ፣ separates a list, ፤ joins
 * clauses. A full stop inside Amharic prose is the clearest sign of a
 * translation nobody read back.
 *
 * Numbers are Western digits, per the profile in locales.ts. Ethiopic has its
 * own numerals and they are not used for arithmetic, so a maths product that
 * printed ፫ where the textbook prints 3 would be showing off rather than
 * helping.
 *
 * NOT YET REVIEWED BY A NATIVE SPEAKER. See docs/i18n.md.
 */
export const am: LocaleOverlay = {
  capture: {
    heading: "ወረቀቱን ያሳዩኝ",
    help: "የገጹ ፎቶ፣ ልጅዎ የጻፈውን ጨምሮ። የጻፈው ነገር ጠቃሚው ክፍል ነው።",
    photoLabel: "ፎቶ ያንሱ ወይም ይምረጡ",
    textLabel: "ወይም ጥያቄውን ይጻፉ",
    textPlaceholder: "ለምሳሌ፦ 1/4 + 2/3 =",
    childWorkLabel: "ልጅዎ እስካሁን የጻፈው (አስፈላጊ አይደለም)",
    submitPhoto: "ይህን ወረቀት አንብብ",
    submitText: "ይህን ጥያቄ ተጠቀም",
    sizeLimit: "ምስሎች ብቻ፣ እስከ 6MB፣ በአንድ ጊዜ አንድ ገጽ።",
    tooLarge: "ይህ ምስል ከ6MB በላይ ነው። ያነሰ ፎቶም እኩል በደንብ ይነበባል።",
    wrongType: "ይህ ፋይል ምስል አይደለም። የገጹ ፎቶ ይሻላል።",
  },

  status: {
    reading: "የጻፈውን እያነበብኩ ነው",
    checking: "ስሌቱን እያረጋገጥኩ ነው",
    matching: "በክፍል የሚሰጠውን ዘዴ እየፈለግኩ ነው",
    writing: "ማብራሪያዎን እየጻፍኩ ነው",
    almost: "ልጨርስ ነው",
    thinking: "ውይይቱን እያነበብኩ ነው",
  },

  transcription: {
    heading: "ያነበብኩት ይህ ነው",
    help: "ምንም ከመጻፌ በፊት ይመልከቱት። አንድ መስመር በስህተት አንብቤ ከሆነ አሁን ያስተካክሉት፤ ከዚያ በኋላ ያለው ሁሉ ትክክል ይሆናል።",
    printedLabel: "የጥያቄው ጽሑፍ",
    workLabel: "ልጅዎ የጻፈው",
    answerLabel: "የጻፈው መልስ",
    edit: "አስተካክል",
    save: "አስቀምጥና ቀጥል",
    lowConfidence: "ያንን መስመር በግልጽ አላነበብኩትም። እርስዎ ሊጽፉት ይችላሉ?",
    confirm: "ትክክል ነው፣ ቀጥል",
  },

  cards: {
    ANXIETY_STATEMENT:
      "ጥናቶች እንደሚሉት በትክክል የሚተላለፈው ይህ ዓይነቱ ዓረፍተ ነገር ነው። ይህን ይሞክሩ፦ ይህ ከባድ ነው፣ አብረን እንፍታው።",
    GENERIC_PRAISE: "ያደረገችውን ይግለጹ፦ ወደ ቀጣዩ ከመሄድሽ በፊት መልስሽን አረጋገጥሽ፣ ዋናው ነገር ያ ነው።",
    TAKES_OVER: "አርባ ሰከንድ ሙሉ ሲናገሩ ነበር። አንድ ነገር ይጠይቁና ይጠብቁ።",
    ESCALATION: "ሃያ ሰከንድ ያቁሙ። አንድ ብርጭቆ ውሃ ይጠጡ። የሚጠፋ ነገር የለም።",
    PRODUCTIVE_WAIT: "እንድታስብ ይተዉአት። ይህ ዝምታ ራሱ ሥራው ነው።",
  },

  register: {
    heading: "እንዴት እንደምጽፍልዎ",
    options: [
      { value: "PLAIN", label: "ቀለል ያለ" },
      { value: "STANDARD", label: "መደበኛ" },
      { value: "TECHNICAL", label: "ጥልቅ" },
    ],
  },

  provenance: {
    fixture: "ይህ የተቀመጠ ምሳሌ ነው፤ የእርስዎ ወረቀት ንባብ አይደለም።",
    generic:
      "ሞዴሉ ምላሽ አልሰጠም፤ ስለዚህ ይህ ለዚህ ርዕስ የተቀመጠው አጠቃላይ ማብራሪያ ነው እንጂ ከልጅዎ ሥራ ተነስቶ የተጻፈ አይደለም።",
  },

  limits: {
    banner: "የዛሬው የሙከራ ገደብ ደርሷል። የተቀመጠ ምሳሌ እያሳየን ነው።",
    spendBanner: "የዛሬውን የወጪ ጣሪያ ደርሰናል። ከስህተት መልእክት ይልቅ የተቀመጠ ምሳሌ እያሳየን ነው።",
    demoBanner: "ይህ የተቀመጠ ምሳሌ ነው።",
    unconfiguredBanner: "ይህ ተከላ እስካሁን አዲስ ወረቀት ማንበብ አይችልም፤ ስለዚህ ይህ የተቀመጠ ምሳሌ ነው።",
    curriculumFallback:
      "የልጅዎ ሥርዓተ ትምህርት ({theirs}) ገና አልተጫነም፤ ስለዚህ ይህ ከ{ours} መስፈርት ጋር ተዛምዷል። ዘዴውና ጥያቄዎቹ አሁንም ይሠራሉ፤ ኮዱና ክፍሉ ግን ላይሠሩ ይችላሉ።",
  },

  errors: {
    modelTimeout: "ሞዴሉ ሁለት ጊዜ ዘገየ፤ ስለዚህ ይህ ለዚህ ርዕስ የተቀመጠው አጠቃላይ ማብራሪያ ነው።",
    malformed: "ሞዴሉ ልናነበው የማንችለውን ነገር ላከ፤ ስለዚህ ይህ ለዚህ ርዕስ የተቀመጠው አጠቃላይ ማብራሪያ ነው።",
    noProblem: "ከዚያ ወረቀት ልናነበው የምንችለው ጥያቄ አላገኘንም። ቀጥ ያለና ቀረብ ያለ ፎቶ አብዛኛውን ጊዜ ይፈታዋል።",
    notFound: "ይህ ገጽ የለም።",
    generic: "በእኛ በኩል የሆነ ችግር ተፈጠረ። ከእርስዎ ምንም አልጠፋም።",
  },

  common: {
    back: "ተመለስ",
    cancel: "ተወው",
    continue: "ቀጥል",
    loading: "እየሠራ ነው",
    backToThread: "ወደ ውይይቱ ተመለስ",
    kindergarten: "መዋዕለ ሕፃናት",
    gradeUnknown: "ክፍል አልተገለጸም",
  },

  setup: {
    heading: "አራት ፈጣን ጥያቄዎች",
    subheading: "አንድ ደቂቃ ይወስዳል፤ ከዚያ በኋላ የሚያዩትን ሁሉ ይለውጣል።",
    step1: {
      heading: "ከእነዚህ የትኛው ይሻልዎታል?",
      help: "ትክክለኛ መልስ የለም። ሌሊቱ ሁለት ሰዓት ላይ ማንበብ የሚፈልጉትን ይምረጡ።",
    },
    step2: {
      heading: "በትምህርት ቤት ሒሳብ ለእርስዎ እንዴት ነበር?",
      help: "ይህ በፍጹም እንደ ውጤት ተመልሶ አይታይዎትም። የቀጥታ ሁነታ ምን ያህል ጊዜ ጣልቃ እንደሚገባ ብቻ ይለውጣል።",
      options: [
        { band: 1, label: "በጣም እወደው ነበር" },
        { band: 2, label: "ጥሩ ነበር፣ ግን አብዛኛውን ረስቼዋለሁ" },
        { band: 3, label: "አልፌበታለሁ፣ ግን አልወደድኩትም" },
        { band: 4, label: "በእውነት ከባድ ጊዜ ነበር" },
      ],
    },
    step3: {
      heading: "ስለ ልጅዎ",
      help: "ስም አስፈላጊ አይደለም። የምንጠቀመው ለእርስዎ በምንጽፋቸው ዓረፍተ ነገሮች ውስጥ ብቻ ነው።",
      gradeLabel: "ክፍል",
      nameLabel: "የመጀመሪያ ስም (አስፈላጊ አይደለም)",
      curriculumLabel: "ሥርዓተ ትምህርት",
      schoolLanguageLabel: "የወረቀቱ ቋንቋ",
      schoolLanguageSame: "እኔ የማናግርዎት ቋንቋ",
      schoolLanguageHelp:
        "ልጅዎ እርስዎ በምቾት ከሚያነቡት የተለየ ቋንቋ የሚማር ከሆነ እዚህ ይግለጹ። በእርስዎ ቋንቋ አብራራለሁ፤ በክፍል የሚሰማቸውንም ቃላት እሰጥዎታለሁ።",
      subjectsLabel: "የትምህርት ዓይነቶች",
    },
    step4: {
      heading: "በየትኛው ቋንቋ ላናግርዎት?",
      help: "ይህ የማብራሪያዎና የምሰጥዎ ዓረፍተ ነገሮች ቋንቋ ነው። ወረቀቱ ከተጻፈበት ቋንቋ የተለየ ነው።",
    },
    finish: "ተጠናቋል፣ ወደ ወረቀቱ ውሰደኝ",
    next: "ቀጣይ",
    back: "ተመለስ",
  },

  packet: {
    primerHeading: "በእርግጥ እየተማረ ያለው ምንድን ነው",
    methodHeading: "የእርስዎና የእነሱ ዘዴ",
    yourMethodLabel: "እርስዎ የተማሩበት መንገድ",
    schoolMethodLabel: "ክፍሉ የሚሠራበት መንገድ",
    bothCorrect: "ሁለቱም ትክክል ናቸው። ክፍሉ ሁለተኛውን የሚፈልገው አስተሳሰቡን ስለሚያሳይ ነው።",
    hintHeading: "አምስት ጥያቄዎች፣ በተራ",
    hintHelp: "አንዱን ይጠይቁ። ይጠብቁ። መጠበቁ ምንም ካላመጣ ብቻ ወደ ቀጣዩ ይሂዱ።",
    hintReveal: "ቀጣዩን ጥያቄ አሳይ",
    hintDone: "አምስቱም አልቀዋል።",
    answerHeading: "መልሱ",
    answerHold: "ለማሳየት ተጭነው ይያዙ",
    answerHolding: "ይዘው ይቆዩ",
    answerWhy: "ከተጫኑ በኋላ ይዘው መቆየት የሚጠይቀው፣ መልሱን መያዝ ቀላሉ መንገድ ስለሆነና ትምህርቱን የሚያቆመው እሱ ስለሆነ ነው።",
    verifiedBadge: "ተረጋግጧል",
    unverifiedBadge: "አልተረጋገጠም",
    verifiedHelp: "ከሞዴሉ ለይተን በኮድ እንደገና አስልተነዋል፤ ሁለቱም ተስማምተዋል።",
    unverifiedHelp: "የእኛ ስሌት ከሞዴሉ ጋር አልተስማማም፤ ስለዚህ መልስ አናሳይም። ከላይ ያሉት ጥያቄዎች አሁንም ጠንካራ ናቸው።",
    scriptsHeading: "የሚባለውና የሚታለፈው",
    scriptAvoid: "ይተው",
    scriptUse: "ይሞክሩ",
    isomorphHeading: "ሌሎች ሦስት ተመሳሳይ",
    isomorphHelp: "ተመሳሳይ ሐሳብ፣ የተለዩ ቁጥሮች። የመጀመሪያው ከገባ በኋላ ይጠቀሙባቸው።",
    misconceptionHeading: "ስህተቱ የት ነው",
    misconceptionRepair: "የሚያስተካክለው ጥያቄ",

    askLabel: "ይህን ይጠይቁና ይጠብቁ",
    rungCounter: (n: number, total: number): string =>
      `ጥያቄ ${formatNumber(n, "am")} ከ${formatNumber(total, "am")}`,
    stillStuck: "አሁንም ተቸግሯል",
    answeredIt: "አግኝቶታል",
    ladderExhausted:
      "ያ የመጨረሻው ነበር። አሁንም ካልገባው፣ መልሱ በዚህ ገጽ ታች አለ፤ እዚህ ማቆምም በጣም ጥሩ ውጤት ነው።",

    solvedHeading: "ጥሩ። ይህ አልቋል።",
    solvedBody: "የደረሰው ጥያቄ በመመለስ እንጂ ተነግሮት አይደለም፤ የሚቀረውም ያ ክፍል ነው።",
    solvedAgain: "ወደ ጥያቄዎቹ ተመለስ",

    discloseWhy: "ለምን ተሳሳተ",
    discloseMethods: "ሁለቱንም ዘዴዎች አሳየኝ",
    discloseTeaching: "ይህ ምን ያስተምራል?",
    discloseScripts: "የሚባለውና የሚታለፈው",
    discloseAnswer: "መልሱን ብቻ ንገረኝ",
    primerMore: "ሙሉውን ያንብቡ",
    genericFallback:
      "ለዚህ አዲስ ማብራሪያ መጻፍ አልቻልኩም፤ ስለዚህ ይህ ለርዕሱ የተቀመጠው አጠቃላይ ማብራሪያ ነው። ትክክል ነው፣ ግን ከልጅዎ ሥራ ተነስቶ የተሠራ አይደለም።",
  },

  live: {
    heading: "የቀጥታ ሁነታ",
    intro:
      "እናንተ ሁለታችሁ ስትሠሩ አዳምጣለሁ። ድምፁ በአሳሽዎ ውስጥ ይቀራል፣ አይሰቀልም፣ አይቀመጥም። የምይዘው ምን ዓይነት ነገር እንደተባለና መቼ እንደሆነ ብቻ ነው።",
    micPrompt: "ማዳመጥ ጀምር",
    micDenied: "አሳሽዎ ማይክሮፎኑን አልሰጠንም። የቀጥታ ሁነታ ያስፈልገዋል፤ ከዚህ ውጪ ምንም አያስፈልገውም።",
    unsupported:
      "ይህ አሳሽ በገጹ ውስጥ ንግግር አይለይም፤ ስለዚህ አጭር የድምጽ ቁራጮችን ልከን እናስጽፋለን። ተጽፈው ይጣላሉ፤ በፍጹም አይቀመጡም።",
    stop: "ክፍለ ጊዜውን ጨርስ",
    listening: "እያዳመጥኩ ነው",
    cardDismiss: "ገባኝ",
    parkHeading: "እዚህ ይተዉት",
    parkBody:
      "ይህ በቂ ጊዜ ወስዷል። ያቁሙ። በመተው የሚጠፋ ነገር የለም፤ ከታች ያለው ማስታወሻ ለመምህሩ የት እንደደረሳችሁ በትክክል ይነግረዋል።",
    parkNoteHeading: "ለመምህሩ ማስታወሻ",
    parkCopy: "ማስታወሻውን ቅዳ",
    parkCopied: "ተቀድቷል",
    cardsSpent: "በዚህ ክፍለ ጊዜ ከዚህ በላይ አላቋርጥዎትም።",

    startShort: "ስንሠራ አዳምጥ",
    stopShort: "ማዳመጥ አቁም",
    listeningInThread: "እያዳመጥኩ ነው። ድምፁ በዚህ አሳሽ ውስጥ ይቀራል።",
    nothingRecorded: "ከዚያ ጊዜ ምንም አልተመዘገበም፤ ስለዚህ የሚጠቃለል ነገር የለም። ድጋፉ ግን ተደርጓል።",
    summaryFailed: "የዚያን ጊዜ ማጠቃለያ ማዘጋጀት አልቻልኩም።",
    summaryHeading: "ያ ጊዜ እንዴት አለፈ",
    summaryProvenance: "ከእነዚያ ቁጥሮች ብቻ የተጻፈ። ምንም ቅጂ አልተቀመጠም፣ ምንም ቃል አልተከማቸም።",
  },

  check: {
    heading: "የተጠናቀቀውን ሥራ ይመልከቱ",
    help: "ምን ዓይነት ስህተት እንዳለ እነግርዎታለሁ። መልሶቹን አልሰጥዎትም፤ ለእርስዎም አላርምም።",
    submit: "ይህን ይመልከቱ",
    resultHeading: "የማየው",
    clean: "እዚህ አለመግባባት የሚመስል ነገር የለም። አሠራሩ ይጣጣማል።",
    noAnswers: "ይህ ገጽ በፍጹም መልስ አያሳይም፤ ሆን ተብሎ ነው። ትርጉሙም ያ ነው።",
  },

  recap: {
    heading: "እንዴት አለፈ",
    ratioLabel: "የራስን አቅም መደገፍ",
    ratioHelp:
      "የተጠየቁ ጥያቄዎች፣ የተለየ ምስጋናና የመጠበቅ ጊዜ፤ ከተሰጡ መልሶች፣ ከአጠቃላይ ምስጋና፣ ከትችትና ሥራውን ከመረከብ ጋር ሲነጻጸር። ከፍ ባለ ቁጥር ልጅዎ የበለጠ አስቧል ማለት ነው።",
    movesHeading: "ምን ተከሰተ",
    noMoves: "በዚህ ክፍለ ጊዜ ምንም አልተመደበም፤ ስለዚህ የሚነገር ነገር የለም።",
    again: "ወደ ወረቀቱ ተመለስ",
  },

  settings: {
    heading: "ቅንብሮች",
    registerHeading: "እንዴት እንደምጽፍልዎ",
    registerHelp: "እያዩት ያለውን ገጽ እያንዳንዱን ቃል ይለውጣል። ገጹን አያድስም።",
    languageHeading: "ቋንቋ",
    anxietyHeading: "የቀጥታ ሁነታ ምን ያህል ጊዜ ጣልቃ እንደሚገባ",
    exportHeading: "የእርስዎ መረጃ",
    exportButton: "ሁሉንም በJSON አውጣ",
    deleteButton: "ሁሉንም አጥፋ",
    deleteConfirm:
      "ይህ መገለጫዎን፣ የልጆችዎን መገለጫ፣ ሁሉንም ወረቀትና ሁሉንም ክፍለ ጊዜ ያጠፋል። መመለስ አይቻልም። ለማረጋገጥ DELETE ብለው ይጻፉ።",
    deleted: "ተጠፍቷል። በእኛ በኩል ከእርስዎ ምንም አልቀረም።",
  },

  chat: {
    emptyIntent: "ወረቀቱን ያሳዩኝና ምን መጠየቅ እንዳለብዎ እነግርዎታለሁ።",
    emptyPhoto: "የገጹን ፎቶ ያንሱ",
    emptyDemo: "ወይም በተቀመጠ ወረቀት ላይ ሲሠራ ይመልከቱ",
    emptyDemoWork: "መካፈያዎቹን ደምሮ 3/7 ጻፈ።",
    emptyDemoNote: "ያለ ፎቶ፣ ያለ መለያ፣ ያለ ክፍያ።",
    demoTurn: "የተቀመጠውን ወረቀት አስኪድ።",
    photoTurn: "ወረቀቱ ይኸውና።",
    placeholder: "ምን እየሆነ እንዳለ ይንገሩኝ",
    note: "ParentPilot የሚያናግረው እርስዎን ነው፤ ልጅዎን በፍጹም አያናግርም።",
    newThread: "አዲስ ወረቀት",
    threadsToday: "ዛሬ",
    threadsWeek: "በዚህ ሳምንት",
    threadsEarlier: "ቀደም ብሎ",
    turnUnconfigured:
      "ይህ ተከላ እስካሁን በራስዎ ቃላት የጻፉትን መመለስ አይችልም። ለቀጣዩ ጥያቄ አሁንም ተቸግሯል የሚለውን ይንኩ፣ ወይም የሚቀጥለውን ገጽ ፎቶ ያንሱ።",
    turnLimit: "የዛሬውን የምላሽ ጣሪያ ደርሰናል። አሁንም ተቸግሯል እና የተቀመጠው ምሳሌ አሁንም ይሠራሉ።",
    turnFailed: "ያ አልደረሰም። እንደገና ይንገሩኝ።",
    answerBehindHold: "እዚህ ነው፣ ከመያዣው ጀርባ።",
    nextQuestion: "የሚቀጥለው ይኸውና።",

    exampleLabel: "በሌሎች ቁጥሮች የተሠራ",
    avoidLabel: "ባይባል የሚሻል፦",
    explainerMore: "ጥቂት ተጨማሪ",
    explainerLess: "ያነሰ",
    explainerChild: "ለዘጠኝ ዓመት ልጅ እንደሚነገር",
    explainerAdult: "ወደ ሙሉው ተመለስ",
    chipsLabel: "ቀጥሎ",
    copyTurn: "ቅዳ",
    copiedTurn: "ተቀድቷል",
    jumpToLatest: "ወደ የቅርብ ጊዜው ሂድ",
    suggestions: ["እየተበሳጨ ነው", "አግኝቶታል ግን የገባው አይመስለኝም", "ምን ባልል ይሻላል"],

    share: "አጋራ",
    shareHeading: "ይህን ለመምህሩ ይላኩ",
    shareHelp:
      "ዛሬ ማታ ከሆነው ተነስቶ በእርስዎ ቃላት የተጻፈ አጭር ማስታወሻ። ያንብቡት፣ የፈለጉትን ይቀይሩ፣ ከዚያ ራስዎ ይላኩት።",
    shareDrafting: "ማስታወሻውን እየጻፍኩ ነው",
    shareCopy: "ማስታወሻውን ቅዳ",
    shareCopied: "ተቀድቷል",
    shareClose: "ዝጋ",
    shareFooter: "በእርስዎ ምትክ ምንም አንልክም፣ ምንም አናስቀምጥም። ማስታወሻው ያለው በዚህ መስኮት ውስጥ ብቻ ነው።",
    shareEmpty: "መጀመሪያ ወረቀት ፎቶ ያንሱ። ለመምህር የሚነገር ነገር ገና የለም።",
    shareUnconfigured: "ይህ ተከላ እስካሁን ማስታወሻ አይጽፍም። በውይይቱ ውስጥ ያለው ሌላው ሁሉ ይሠራል።",
    shareLimit: "የዛሬውን የጽሑፍ ጣሪያ ደርሰናል። ውይይቱ አልተነካም።",
    shareFailed: "አሁን ማስታወሻውን መጻፍ አልተቻለም። ከአንድ ደቂቃ በኋላ ይሞክሩ።",
  },

  login: {
    heading: "ይግቡ",
    help: "አገናኝ በኢሜይል እንልክልዎታለን። የሚረሱት የይለፍ ቃል የለም፤ ልጅዎም የሚገባበት ነገር የለም።",
    emailLabel: "ኢሜይልዎ",
    submit: "አገናኝ ላኩልኝ",
    sent: "ኢሜይልዎን ይመልከቱ። አገናኙ አንድ ጊዜ ይሠራል፣ ለአሥራ አምስት ደቂቃ ይቆያል።",
    sentQuiet: "ያ አድራሻ ከዚህ በፊት እዚህ ተጠቅሞ ከነበረ፣ አገናኙ ያንኑ መገለጫ ይከፍታል።",
    unconfigured:
      "ይህ ተከላ እስካሁን ኢሜይል መላክ አይችልም፤ ስለዚህ አገናኙ በአገልጋዩ መዝገብ ላይ ተጻፈ። አንድ አንቀሳቃሽ ሊያወጣው ይችላል።",
    failed: "ያን ኢሜይል መላክ አልቻልንም። ከአንድ ደቂቃ በኋላ ይሞክሩ።",
    invalid: "ያ አገናኝ ዋጋ የለውም። አዲስ ይጠይቁ።",
    expired: "ያ አገናኝ ጊዜው አልፎበታል። አዲስ ይጠይቁ።",
    used: "ያ አገናኝ አስቀድሞ ተጠቅሟል። አዲስ ይጠይቁ።",
    anonymousNote:
      "መለያ አያስፈልግዎትም። ሙከራውና አንድ ወረቀት ያለ መለያ ይሠራሉ፤ መግባት ታሪክዎን የሚያስቀምጠው ነው።",

    emailSubject: "የParentPilot መግቢያ አገናኝዎ",
    emailBody: "የመግቢያ አገናኝዎ ይኸውና። አንድ ጊዜ ይሠራል፣ ለአሥራ አምስት ደቂቃ ይቆያል።",
    emailLinkLabel: "ወደ ParentPilot ይግቡ",
    emailFooter: "ይህን ካልጠየቁ ችላ ይበሉት። ምንም አልተፈጠረም።",
  },

  account: {
    heading: "መለያዎ",
    signedInAs: "የገቡት እንደ",
    anonymous: "አልገቡም። ሁሉም ነገር ይሠራል፤ ከዚህ አሳሽ ውጪ ምንም አይቀመጥም።",
    signIn: "ይግቡ",
    signOut: "ውጣ",
    childrenHeading: "ልጆች",
    noChildren: "ገና መገለጫ የለም። ዝግጅቱ አንድ ይፈጥራል።",
    childNote: "መገለጫ እንጂ መለያ አይደለም። ልጅ የሚገባበት ምንም ነገር እዚህ የለም።",
    preferencesHeading: "እንዴት እንደምጽፍልዎ",
  },

  history: {
    heading: "ያለፉ ክፍለ ጊዜዎች",
    empty: "ገና ክፍለ ጊዜ የለም። የቀጥታ ሁነታን ከተጠቀሙ በኋላ እዚህ ይታያሉ።",
    anonymous: "ታሪክዎን በሁሉም መሣሪያዎችዎ ለማስቀመጥ ይግቡ።",
    ratioLabel: "ራስን መቻል",
    problemsLabel: "የተሠሩ ጥያቄዎች",
    shareLabel: "ከመምህር ጋር ያጋሩ",
    shareCreate: "አገናኝ ፍጠር",
    shareCopy: "አገናኙን ቅዳ",
    shareCopied: "ተቀድቷል",
    shareRevoke: "ሰርዝ",
    shareRevoked: "ተሰርዟል። አገናኙ ከዚህ በኋላ አይከፍትም።",
    shareExpires: "ጊዜው የሚያበቃው",
    openRecap: "ማጠቃለያውን ክፈት",
  },

  shared: {
    heading: "የቤት ሥራ ክፍለ ጊዜ",
    explainer:
      "ይህ አንድ ወላጅ ከእርስዎ ጋር ለማጋራት የመረጠው የንባብ ብቻ ማጠቃለያ ነው። ምን እንደተሠራና ምን ዓይነት ነገር እንደተባለ ያሳያል እንጂ ቃላቱን ራሳቸውን በፍጹም አያሳይም። እዚህ ምንም አልተቀዳም።",
    problemsHeading: "የተሠራው",
    errorHeading: "የተቸገረበት",
    ratioHeading: "ድጋፉ እንዴት እንደተከፋፈለ",
    noteHeading: "ወላጁ የጻፈው ማስታወሻ",
    expired: "የዚህ አገናኝ ጊዜ አልፏል።",
    unknown: "ይህ አገናኝ ምንም አይከፍትም።",
  },

  audio: {
    play: "ይህን ያዳምጡ",
    loading: "ድምፁን እያዘጋጀሁ ነው",
    playing: "እየተጫወተ ነው",
    pause: "አቁም",
    unavailable: "በዚህ ተከላ ድምጽ የለም።",
    help: "ተመሳሳዩ ማብራሪያ፣ ጮክ ብሎ የተነበበ፤ ማንበብ ከባዱ ክፍል ለሆነ ጊዜ።",
  },
};
