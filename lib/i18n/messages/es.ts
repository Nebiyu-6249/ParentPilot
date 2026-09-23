import type { LocaleOverlay } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/numbers";

/**
 * Spanish.
 *
 * Written for a parent at the kitchen table, so it uses tú throughout. Usted
 * would be more formal and less true: this product sits next to somebody at
 * eight in the evening, and the register of a bank letter would undo half of
 * what the copy is for.
 *
 * Three choices worth naming, because a reviewer will notice them and should
 * know they were decisions rather than accidents.
 *
 * Diacritics are written. The language picker in this repo said "Espanol" and
 * "Francais", and copying that convention into a whole catalogue would have
 * produced something that is not Spanish. The picker is fixed too.
 *
 * Gender. The English copy says "she" because the saved example is one girl.
 * Spanish forces that choice far more often, so this says tu hija where the
 * saved example is meant, and rewrites the sentence everywhere else rather
 * than writing tu hijo/a, which reads as a form.
 *
 * Peninsular Spanish, matching the number profile in locales.ts. A Mexican
 * family would want vocabulary changes here as well as the decimal separator,
 * and both belong in an es-MX overlay rather than in a compromise that suits
 * neither.
 *
 * NOT YET REVIEWED BY A NATIVE SPEAKER. See docs/i18n.md.
 */
export const es: LocaleOverlay = {
  capture: {
    heading: "Enséñame la hoja",
    help: "Una foto de la página, con lo que tu hija ya haya escrito. Lo que ha escrito ella es la parte útil.",
    photoLabel: "Hacer o elegir una foto",
    textLabel: "O escribe el ejercicio",
    textPlaceholder: "Por ejemplo: 1/4 + 2/3 =",
    childWorkLabel: "Lo que lleva escrito hasta ahora (opcional)",
    submitPhoto: "Leer esta hoja",
    submitText: "Usar este ejercicio",
    sizeLimit: "Solo imágenes, hasta 6MB, una página cada vez.",
    tooLarge: "Esa imagen pasa de 6MB. Una foto más pequeña se lee igual de bien.",
    wrongType: "Ese archivo no es una imagen. Una foto de la página funciona mejor.",
  },

  status: {
    reading: "Leyendo lo que ha escrito",
    checking: "Comprobando las cuentas",
    matching: "Buscando qué método dan en clase",
    writing: "Escribiendo tu resumen",
    almost: "Casi está",
    thinking: "Leyendo la conversación",
  },

  transcription: {
    heading: "Esto es lo que he leído",
    help: "Revísalo antes de que escriba nada. Si he leído mal una línea, corrígela ahora y todo lo de después saldrá bien.",
    printedLabel: "El enunciado",
    workLabel: "Lo que ha escrito tu hija",
    answerLabel: "Su resultado",
    edit: "Editar",
    save: "Guardar y seguir",
    lowConfidence: "Esa línea no la leo con claridad. ¿Me la escribes?",
    confirm: "Correcto, sigue",
  },

  cards: {
    ANXIETY_STATEMENT:
      "Esa frase es justo la que se contagia, según los estudios. Prueba con: esta es difícil, vamos a sacarla entre las dos.",
    GENERIC_PRAISE:
      "Di lo que ha hecho: has comprobado el resultado antes de pasar a la siguiente, eso es lo que cuenta.",
    TAKES_OVER: "Llevas 40 segundos hablando. Pregunta algo y espera.",
    ESCALATION: "Párate 20 segundos. Ve a por un vaso de agua. No se pierde nada.",
    PRODUCTIVE_WAIT: "Déjala pensar. Este silencio es el trabajo.",
  },

  register: {
    heading: "Cómo te escribo",
    options: [
      { value: "PLAIN", label: "Más sencillo" },
      { value: "STANDARD", label: "Normal" },
      { value: "TECHNICAL", label: "Más técnico" },
    ],
  },

  provenance: {
    fixture: "Este es un ejemplo guardado, no una lectura de tu hoja.",
    generic:
      "El modelo no ha respondido, así que esta es la explicación general guardada para este tema y no una escrita a partir de lo que ha hecho tu hija.",
  },

  limits: {
    banner: "Límite de demostración alcanzado por hoy. Te enseñamos un ejemplo guardado.",
    spendBanner: "Hemos llegado al gasto máximo de hoy. Te enseñamos un ejemplo guardado en lugar de un error.",
    demoBanner: "Este es un ejemplo guardado.",
    unconfiguredBanner:
      "Esta instalación todavía no puede leer hojas nuevas, así que esto es un ejemplo guardado.",
    curriculumFallback:
      "El currículo de tu hija ({theirs}) todavía no está cargado, así que esto se ha emparejado con un estándar de {ours}. El método y las preguntas siguen sirviendo; el código y el curso puede que no.",
  },

  errors: {
    modelTimeout:
      "El modelo ha tardado demasiado dos veces, así que esta es la explicación general guardada para este tema.",
    malformed:
      "El modelo ha enviado algo que no hemos podido leer, así que esta es la explicación general guardada para este tema.",
    noProblem: "De esa hoja no he sacado ningún ejercicio legible. Una foto más recta y más cerca suele arreglarlo.",
    notFound: "Esta página no existe.",
    generic: "Algo ha fallado por nuestra parte. No se ha perdido nada tuyo.",
  },

  common: {
    back: "Atrás",
    cancel: "Cancelar",
    continue: "Continuar",
    loading: "Trabajando",
    backToThread: "Volver a la conversación",
    kindergarten: "Infantil",
    gradeUnknown: "Curso sin indicar",
  },

  setup: {
    heading: "Cuatro preguntas rápidas",
    subheading: "Se tarda un minuto y cambia todo lo que verás después.",
    step1: {
      heading: "¿Cuál de estas se te lee mejor?",
      help: "No hay respuesta correcta. Elige la que querrías leer a las ocho de la tarde.",
    },
    step2: {
      heading: "¿Cómo se te dieron las mates en el colegio?",
      help: "Esto no se te devuelve nunca como nota. Solo cambia cada cuánto interviene el modo en directo.",
      options: [
        { band: 1, label: "Me encantaban" },
        { band: 2, label: "Bien, pero se me ha olvidado casi todo" },
        { band: 3, label: "Fui tirando, nunca me gustaron" },
        { band: 4, label: "Lo pasé francamente mal" },
      ],
    },
    step3: {
      heading: "Sobre tu hija",
      help: "El nombre es opcional. Solo lo usamos dentro de las frases que escribimos para ti.",
      gradeLabel: "Curso",
      nameLabel: "Nombre (opcional)",
      curriculumLabel: "Currículo",
      schoolLanguageLabel: "El idioma de la hoja",
      schoolLanguageSame: "El mismo en el que me hablas",
      schoolLanguageHelp:
        "Si a tu hija le dan clase en un idioma distinto del que tú lees con más soltura, dilo aquí. Te lo explico en el tuyo y te doy las palabras que ella va a oír en clase.",
      subjectsLabel: "Materias",
    },
    step4: {
      heading: "¿En qué idioma quieres que te hable?",
      help: "Es el idioma de tu resumen y de las frases que te doy. Es distinto del idioma en el que está escrita la hoja.",
    },
    finish: "Listo, llévame a la hoja",
    next: "Siguiente",
    back: "Atrás",
  },

  packet: {
    primerHeading: "Qué se está enseñando en realidad",
    methodHeading: "Tu método y el suyo",
    yourMethodLabel: "Como te lo enseñaron a ti",
    schoolMethodLabel: "Como lo hacen en clase",
    bothCorrect: "Los dos son correctos. En clase quieren el segundo porque deja ver el razonamiento.",
    hintHeading: "Cinco preguntas, por orden",
    hintHelp: "Haz una. Espera. Pasa a la siguiente solo si la espera no ha dado nada.",
    hintReveal: "Ver la siguiente pregunta",
    hintDone: "Eso es todo.",
    answerHeading: "El resultado",
    answerHold: "Mantén pulsado para verlo",
    answerHolding: "Sigue pulsando",
    answerWhy:
      "Está detrás de una pulsación larga porque tirar de él es lo fácil, y es justo lo que corta el aprendizaje.",
    verifiedBadge: "Comprobado",
    unverifiedBadge: "Sin comprobar",
    verifiedHelp: "Lo hemos vuelto a calcular por código, aparte del modelo, y los dos coinciden.",
    unverifiedHelp:
      "Nuestro cálculo no coincide con el del modelo, así que no enseñamos ningún resultado. Las preguntas de arriba siguen siendo buenas.",
    scriptsHeading: "Qué decir y qué callar",
    scriptAvoid: "Mejor no",
    scriptUse: "Prueba",
    isomorphHeading: "Tres más del mismo tipo",
    isomorphHelp: "La misma idea con otros números. Úsalos cuando el primero ya haya encajado.",
    misconceptionHeading: "Dónde está el fallo",
    misconceptionRepair: "La pregunta que lo arregla",

    askLabel: "Pregunta esto y espera",
    rungCounter: (n: number, total: number): string =>
      `Pregunta ${formatNumber(n, "es")} de ${formatNumber(total, "es")}`,
    stillStuck: "Sigue atascada",
    answeredIt: "Ya lo ha sacado",
    ladderExhausted:
      "Esa era la última. Si aún no le entra, el resultado está al final de la pantalla, y parar aquí es un final perfectamente bueno.",

    solvedHeading: "Bien. Esa ya está.",
    solvedBody: "Ha llegado contestando a una pregunta y no porque se lo dijeran, que es la parte que se queda.",
    solvedAgain: "Volver a las preguntas",

    discloseWhy: "Por qué se ha equivocado",
    discloseMethods: "Enséñame los dos métodos",
    discloseTeaching: "¿Qué se aprende con esto?",
    discloseScripts: "Qué decir y qué callar",
    discloseAnswer: "Dime el resultado y ya",
    primerMore: "Leerlo entero",
    genericFallback:
      "No he podido escribir un resumen nuevo para este, así que esta es la explicación general guardada para el tema. Es correcta, pero no está hecha a partir de lo que escribió tu hija.",
  },

  voice: {
    hold: "Mantén pulsado para hablar",
    holding: "Te escucho, suelta para enviar",
    thinking: "Pensando qué decirte",
    speaking: "Hablando",
    stop: "Parar",
    activeVoice: "Modo voz. Te contesto en voz alta.",
    activeLive: "Modo en directo. Escucho y te acompaño, no contesto.",
    keepListening: "Dejar el micro abierto después de contestar",
    keepListeningHelp:
      "Lo deja abierto unos segundos para que puedas seguir sin volver a coger el móvil.",
    childCanHear: "Ella puede oír esto",
    childCanHearHelp:
      "Activado, nunca digo el resultado en voz alta, nunca digo en qué se ha equivocado y nunca uso su nombre. La versión completa se queda en tu pantalla, donde solo la lees tú.",
    childCanHearOffHelp:
      "Desactivado, puedo ser más directa en voz alta. El resultado sigue saliendo solo de la pulsación larga.",
    onScreen: "Está en tu pantalla, detrás de la pulsación.",
    unconfigured: "Esta instalación todavía no puede hablar. Lo demás funciona.",
    limit: "Hemos llegado al límite de voz de hoy. Escribir sigue funcionando.",
    nothingHeard: "No te he pillado. Mantén el botón pulsado mientras hablas.",
    tooLong: "Esa ha sido larga. Prueba otra vez en una o dos frases.",
    failed: "Eso no ha llegado. Dímelo otra vez.",
    micDenied: "Tu navegador no nos ha dado el micrófono. El modo voz lo necesita.",
    unsupported: "Este navegador no puede grabar audio, así que el modo voz está apagado. Escribir sí funciona.",
  },

  live: {
    heading: "Modo en directo",
    intro:
      "Escucho mientras trabajáis las dos. El audio se queda en tu navegador, no se sube y no se guarda. Yo solo me quedo con qué tipo de cosa se dijo y cuándo.",
    micPrompt: "Empezar a escuchar",
    micDenied: "Tu navegador no nos ha dado el micrófono. El modo en directo lo necesita, y nada más lo necesita.",
    unsupported:
      "Este navegador no reconoce voz en la propia página, así que enviaremos fragmentos cortos de audio para transcribirlos. Se transcriben y se descartan, nunca se guardan.",
    stop: "Terminar",
    listening: "Escuchando",
    cardDismiss: "Entendido",
    parkHeading: "Déjalo aquí",
    parkBody:
      "Esta ya ha durado bastante. Para. No se pierde nada por dejarla, y la nota de abajo le dice al profesor exactamente por dónde ibais.",
    parkNoteHeading: "Una nota para el profesor",
    parkCopy: "Copiar la nota",
    parkCopied: "Copiada",
    cardsSpent: "Ya no te interrumpo más en esta sesión.",

    startShort: "Escuchar mientras trabajamos",
    stopShort: "Dejar de escuchar",
    listeningInThread: "Escuchando. El audio se queda en este navegador.",
    nothingRecorded:
      "De ese rato no se registró nada, así que no hay nada que resumir. El acompañamiento sí ocurrió.",
    summaryFailed: "No he podido montar el resumen de ese rato.",
    summaryHeading: "Cómo ha ido ese rato",
    summaryProvenance:
      "Escrito solo a partir de esos recuentos. No se guardó ninguna grabación ni ninguna palabra.",
  },

  check: {
    heading: "Revisar el trabajo terminado",
    help: "Te digo qué tipo de fallo hay. No te doy los resultados y no te lo corrijo.",
    submit: "Mirar esto",
    resultHeading: "Lo que veo",
    clean: "Aquí no hay nada que parezca un malentendido. El razonamiento se sostiene.",
    noAnswers: "Esta pantalla nunca enseña resultados, a propósito. Ese es justo su sentido.",
  },

  recap: {
    heading: "Cómo ha ido",
    ratioLabel: "Apoyo a la autonomía",
    ratioHelp:
      "Preguntas hechas, elogios concretos y tiempo esperando, frente a resultados dados, elogios genéricos, críticas y hacerlo tú. Cuanto más alto, más ha pensado tu hija.",
    movesHeading: "Qué ha pasado",
    noMoves: "En esta sesión no se clasificó nada, así que no hay nada que contar.",
    again: "Volver a la hoja",
  },

  settings: {
    heading: "Ajustes",
    registerHeading: "Cómo te escribo",
    registerHelp: "Cambia todas las palabras de la pantalla que estás mirando. No recarga la página.",
    languageHeading: "Idioma",
    anxietyHeading: "Cada cuánto interviene el modo en directo",
    exportHeading: "Tus datos",
    exportButton: "Exportarlo todo en JSON",
    deleteButton: "Borrarlo todo",
    deleteConfirm:
      "Esto borra tu perfil, el de tus hijos, todas las hojas y todas las sesiones. No se puede deshacer. Escribe DELETE para confirmar.",
    deleted: "Borrado. De tu parte no queda nada por aquí.",
  },

  chat: {
    emptyIntent: "Enséñame la hoja y te digo qué preguntar.",
    emptyPhoto: "Hacer una foto de la página",
    emptyDemo: "O verlo funcionar con una hoja guardada",
    emptyDemoWork: "Ha sumado los denominadores y ha escrito 3/7.",
    emptyDemoNote: "Sin foto, sin cuenta, sin coste.",
    demoTurn: "Prueba la hoja guardada.",
    photoTurn: "Aquí está la hoja.",
    placeholder: "Cuéntame qué está pasando",
    note: "ParentPilot habla contigo, nunca con tu hija.",
    newThread: "Hoja nueva",
    threadsToday: "Hoy",
    threadsWeek: "Esta semana",
    threadsEarlier: "Antes",
    turnUnconfigured:
      "Esta instalación todavía no puede responder a lo que escribes. Toca Sigue atascada para la siguiente pregunta, o fotografía la página siguiente.",
    turnLimit:
      "Hemos llegado al límite de respuestas de hoy. Sigue atascada y el ejemplo guardado siguen funcionando.",
    turnFailed: "Eso no ha llegado. Dímelo otra vez.",
    answerBehindHold: "Está aquí, detrás de la pulsación.",
    nextQuestion: "Esta es la siguiente que puedes probar.",

    exampleLabel: "Resuelto con otros números",
    avoidLabel: "Mejor no decir:",
    explainerMore: "Un poco más",
    explainerLess: "Menos",
    explainerChild: "Dicho para alguien de nueve años",
    explainerAdult: "Volver a la versión completa",
    chipsLabel: "Y ahora",
    copyTurn: "Copiar",
    copiedTurn: "Copiado",
    jumpToLatest: "Ir a lo último",
    suggestions: [
      "se está poniendo nerviosa",
      "lo ha sacado pero creo que no lo entiende",
      "qué es mejor que no le diga",
    ],

    share: "Compartir",
    shareHeading: "Mandarle esto al profesor",
    shareHelp:
      "Una nota corta con tus palabras, hecha con lo que ha pasado esta noche. Léela, cambia lo que quieras y mándala tú.",
    shareDrafting: "Escribiendo la nota",
    shareCopy: "Copiar la nota",
    shareCopied: "Copiada",
    shareClose: "Cerrar",
    shareFooter: "No mandamos nada por ti y no guardamos nada. La nota solo existe en esta ventana.",
    shareEmpty: "Fotografía una hoja primero. Todavía no hay nada que contarle a un profesor.",
    shareUnconfigured:
      "Esta instalación todavía no puede redactar notas. Todo lo demás de la conversación funciona igual.",
    shareLimit: "Hemos llegado al límite de redacción de hoy. La conversación no se ve afectada.",
    shareFailed: "Ahora mismo no he podido redactar la nota. Pruébalo dentro de un minuto.",
  },

  login: {
    heading: "Entrar",
    help: "Te mandamos un enlace por correo. No hay contraseña que olvidar, y no hay nada donde tu hija pueda entrar.",
    emailLabel: "Tu correo",
    submit: "Mándame un enlace",
    sent: "Mira tu correo. El enlace sirve una vez y dura quince minutos.",
    sentQuiet: "Si esa dirección ya se ha usado aquí, el enlace abrirá el mismo perfil.",
    unconfigured:
      "Esta instalación todavía no puede mandar correo, así que el enlace se ha escrito en el registro del servidor. Un operador puede sacarlo de ahí.",
    failed: "No hemos podido mandar ese correo. Pruébalo dentro de un minuto.",
    invalid: "Ese enlace no vale. Pide uno nuevo.",
    expired: "Ese enlace ha caducado. Pide uno nuevo.",
    used: "Ese enlace ya se ha usado. Pide uno nuevo.",
    anonymousNote:
      "No hace falta cuenta. La demostración y una hoja funcionan sin ella; entrar es lo que guarda tu historial.",

    emailSubject: "Tu enlace de acceso a ParentPilot",
    emailBody: "Aquí tienes tu enlace de acceso. Sirve una vez y dura quince minutos.",
    emailLinkLabel: "Entrar en ParentPilot",
    emailFooter: "Si no lo has pedido tú, puedes ignorarlo. No se ha creado nada.",
  },

  account: {
    heading: "Tu cuenta",
    signedInAs: "Has entrado como",
    anonymous: "No has entrado. Todo funciona igual; no se guarda nada fuera de este navegador.",
    signIn: "Entrar",
    signOut: "Salir",
    childrenHeading: "Hijos",
    noChildren: "Todavía no hay ningún perfil. La configuración inicial crea uno.",
    childNote: "Un perfil, no una cuenta. Aquí no hay nada donde una niña pueda entrar.",
    preferencesHeading: "Cómo te escribo",
  },

  history: {
    heading: "Sesiones anteriores",
    empty: "Todavía no hay sesiones. Aparecerán aquí cuando uses el modo en directo.",
    anonymous: "Entra para conservar tu historial en todos tus dispositivos.",
    ratioLabel: "Autonomía",
    problemsLabel: "Ejercicios trabajados",
    shareLabel: "Compartir con un profesor",
    shareCreate: "Crear un enlace",
    shareCopy: "Copiar el enlace",
    shareCopied: "Copiado",
    shareRevoke: "Anular",
    shareRevoked: "Anulado. El enlace ya no abre nada.",
    shareExpires: "Caduca",
    openRecap: "Abrir el resumen",
  },

  shared: {
    heading: "Una sesión de deberes",
    explainer:
      "Esto es un resumen de solo lectura que un padre o una madre ha decidido compartir contigo. Enseña en qué se trabajó y qué tipo de cosas se dijeron, nunca las palabras. Aquí no se grabó nada.",
    problemsHeading: "En qué se trabajó",
    errorHeading: "Dónde se atascó",
    ratioHeading: "Cómo estuvo repartida la ayuda",
    noteHeading: "La nota que redactó la familia",
    expired: "Este enlace ha caducado.",
    unknown: "Este enlace no abre nada.",
  },

  audio: {
    play: "Escuchar esto",
    loading: "Preparando el audio",
    playing: "Sonando",
    pause: "Pausa",
    unavailable: "En esta instalación no hay audio.",
    help: "La misma explicación, leída en voz alta, para cuando leer es lo difícil.",
  },
};
