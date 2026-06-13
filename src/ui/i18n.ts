type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

export type Leaves<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
  ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : "";

export const en = {
  nav: {
    home: "Home",
    play: "Play",
    stats: "Statistics",
    about: "About",
    highscores: "High Scores",
    wiki: "Wiki",
    news: "News",
    download: "Download",
    loginRegister: "Login/Register",
  },
  stats: {
    title: "Realm Status",
    accountsCreated: "Accounts Created",
    playersOnline: "Players Online",
    realmName: "Realm Name",
  },
  footer: {
    copyright: "2026 World of Claudecraft",
    githubLink: "https://github.com/levy-street/world-of-claudecraft",
    githubLabel: "Open Source Project",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    discordLabel: "Join the Discord",
  },
  highscores: {
    title: "High Scores Leaderboard",
    desc: "Track the realm's greatest champions and compare your progress.",
  },
  wiki: {
    title: "Game Wiki & Guide",
    desc: "Discover the secrets of the realm, class guides, and strategies.",
  },
  news: {
    title: "News & Updates",
    desc: "Read the latest patch notes, events, and community updates.",
  },
  download: {
    title: "Download Desktop Launcher",
    desc: "Get the standalone launcher for optimized performance and full-screen play.",
  },
  comingSoon: {
    placeholder: "Coming Soon...",
    featureComingSoon: "This feature is coming soon to the realm.",
  },
  mode: {
    onlineTitle: "Play Online",
    onlineDesc: "Log in to the realm. Your characters live on the server and you share the world with everyone else who's on.",
    onlineAria: "Play Online: log in to the persistent shared realm",
    offlineTitle: "Play Offline",
    offlineDesc: "Instant single-player world in your browser. Nothing is saved: perfect for a quick brawl or testing.",
    offlineAria: "Play Offline: start an instant local single-player session",
    tipTitle: "TIP:",
    tipText: "For the smoothest experience, turn off ad blocker extensions on this site. Community reports found some blockers can cause lag.",
  },
  auth: {
    enterRealm: "Enter the Realm",
    username: "Username",
    usernameError: "Please enter your username.",
    usernamePlaceholder: "Enter username",
    password: "Password",
    passwordError: "Please enter your password.",
    passwordPlaceholder: "Enter password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    logIn: "Log In",
    createAccount: "Create Account",
    back: "Back",
    realmList: "Realm List",
    loadingRealms: "Loading realms...",
    changeRealm: "Change Realm",
    characters: "Characters:",
    createCharacter: "Create Character",
    characterName: "Character Name",
    characterNamePlaceholder: "Character name",
    enterWorld: "Enter World",
    offlineCharacter: "Offline Character",
    create: "Create",
  },
  classes: {
    warrior: "Warrior",
    paladin: "Paladin",
    hunter: "Hunter",
    rogue: "Rogue",
    priest: "Priest",
    shaman: "Shaman",
    mage: "Mage",
    warlock: "Warlock",
    druid: "Druid",
    warriorAria: "Warrior class",
    paladinAria: "Paladin class",
    hunterAria: "Hunter class",
    rogueAria: "Rogue class",
    priestAria: "Priest class",
    shamanAria: "Shaman class",
    mageAria: "Mage class",
    warlockAria: "Warlock class",
    druidAria: "Druid class",
  },
  controls: {
    title: "Controls Guide",
    movement: "Movement",
    moveTurn: "Move / Turn",
    strafe: "Strafe Left/Right",
    jump: "Jump",
    autorun: "Toggle Autorun",
    combat: "Combat & Interaction",
    target: "Target Enemy",
    spells: "Cast Spells",
    interact: "Interact / Loot",
    nameplates: "Toggle Nameplates",
    camera: "Camera & Mouse",
    rightDrag: "Right-Drag",
    leftDrag: "Left-Drag",
    mouseWheel: "Mouse Wheel",
    mouselook: "Mouselook",
    orbit: "Orbit Camera",
    zoom: "Zoom",
    interfaces: "Interfaces",
    charPane: "Character Pane",
    spellbook: "Spellbook",
    questLog: "Quest Log",
    worldMap: "World Map",
    bags: "Bags Inventory",
    friends: "Friends & Guild",
    chat: "Open Chat",
  },
};

export const es: typeof en = {
  nav: {
    home: "Inicio",
    play: "Jugar",
    stats: "Estadísticas",
    about: "Acerca de",
    highscores: "Clasificaciones",
    wiki: "Wiki",
    news: "Noticias",
    download: "Descargar",
    loginRegister: "Iniciar Sesión/Registrarse",
  },
  stats: {
    title: "Estado del Reino",
    accountsCreated: "Cuentas Creadas",
    playersOnline: "Jugadores en Línea",
    realmName: "Nombre del Reino",
  },
  footer: {
    copyright: "2026 World of Claudecraft",
    githubLink: "https://github.com/levy-street/world-of-claudecraft",
    githubLabel: "Proyecto de Código Abierto",
    terms: "Términos de Servicio",
    privacy: "Política de Privacidad",
    discordLabel: "Únete al Discord",
  },
  highscores: {
    title: "Clasificaciones de Puntuación",
    desc: "Sigue a los campeones más grandes del reino y compara tu progreso.",
  },
  wiki: {
    title: "Wiki y Guía del Juego",
    desc: "Descubre los secretos del reino, guías de clase y estrategias.",
  },
  news: {
    title: "Noticias y Actualizaciones",
    desc: "Lee las últimas notas del parche, eventos y noticias de la comunidad.",
  },
  download: {
    title: "Descargar Lanzador de Escritorio",
    desc: "Consigue el lanzador independiente para un rendimiento optimizado y juego a pantalla completa.",
  },
  comingSoon: {
    placeholder: "Próximamente...",
    featureComingSoon: "Esta característica llegará pronto al reino.",
  },
  mode: {
    onlineTitle: "Jugar en Línea",
    onlineDesc: "Inicia sesión en el reino. Tus personajes viven en el servidor y compartes el mundo con todos los demás que estén conectados.",
    onlineAria: "Jugar en Línea: inicia sesión en el reino compartido persistente",
    offlineTitle: "Jugar en Solitario",
    offlineDesc: "Mundo instantáneo en solitario en tu navegador. Nada se guarda: perfecto para una pelea rápida o pruebas.",
    offlineAria: "Jugar en Solitario: inicia una sesión local instantánea de un jugador",
    tipTitle: "CONSEJO:",
    tipText: "Para la mejor experiencia, desactiva las extensiones de bloqueo de publicidad en este sitio. Reportes de la comunidad encontraron que algunos bloqueadores pueden causar retrasos.",
  },
  auth: {
    enterRealm: "Entrar al Reino",
    username: "Usuario",
    usernameError: "Por favor, introduce tu nombre de usuario.",
    usernamePlaceholder: "Introduce tu usuario",
    password: "Contraseña",
    passwordError: "Por favor, introduce tu contraseña.",
    passwordPlaceholder: "Introduce tu contraseña",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    logIn: "Iniciar Sesión",
    createAccount: "Crear Cuenta",
    back: "Atrás",
    realmList: "Lista de Reinos",
    loadingRealms: "Cargando reinos...",
    changeRealm: "Cambiar de Reino",
    characters: "Personajes:",
    createCharacter: "Crear Personaje",
    characterName: "Nombre del Personaje",
    characterNamePlaceholder: "Nombre del personaje",
    enterWorld: "Entrar al Mundo",
    offlineCharacter: "Personaje en Solitario",
    create: "Crear",
  },
  classes: {
    warrior: "Guerrero",
    paladin: "Paladín",
    hunter: "Cazador",
    rogue: "Pícaro",
    priest: "Sacerdote",
    shaman: "Chamán",
    mage: "Mago",
    warlock: "Brujo",
    druid: "Druida",
    warriorAria: "Clase Guerrero",
    paladinAria: "Clase Paladín",
    hunterAria: "Clase Cazador",
    rogueAria: "Clase Pícaro",
    priestAria: "Clase Sacerdote",
    shamanAria: "Clase Chamán",
    mageAria: "Clase Mago",
    warlockAria: "Clase Brujo",
    druidAria: "Clase Druida",
  },
  controls: {
    title: "Guía de Controles",
    movement: "Movimiento",
    moveTurn: "Moverse / Girar",
    strafe: "Desplazarse Izquierda/Derecha",
    jump: "Saltar",
    autorun: "Correr Automáticamente",
    combat: "Combate e Interacción",
    target: "Marcar Enemigo",
    spells: "Lanzar Hechizos",
    interact: "Interactuar / Despojar",
    nameplates: "Mostrar Nombres",
    camera: "Cámara y Ratón",
    rightDrag: "Arrastrar Clic Derecho",
    leftDrag: "Arrastrar Clic Izquierdo",
    mouseWheel: "Rueda del Ratón",
    mouselook: "Mirar con Ratón",
    orbit: "Rotar Cámara",
    zoom: "Zoom",
    interfaces: "Interfaces",
    charPane: "Panel de Personaje",
    spellbook: "Libro de Hechizos",
    questLog: "Diario de Misiones",
    worldMap: "Mapa del Mundo",
    bags: "Inventario de Bolsas",
    friends: "Amigos y Hermandad",
    chat: "Abrir Chat",
  },
};

const translations = { en, es };

let currentLanguage: "en" | "es" = "en";

// Initialize language from localStorage if available (browser environments)
if (typeof localStorage !== "undefined") {
  const saved = localStorage.getItem("locale");
  if (saved === "en" || saved === "es") {
    currentLanguage = saved;
  }
}

export function getLanguage(): "en" | "es" {
  return currentLanguage;
}

export function setLanguage(lang: "en" | "es"): void {
  currentLanguage = lang;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("locale", lang);
  }
}

export function t(key: Leaves<typeof en>): string {
  const parts = key.split(".");
  let current: any = translations[currentLanguage];
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = current[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}
