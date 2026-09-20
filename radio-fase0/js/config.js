// ─────────────────────────────────────────────────────────────
//  Configuración de la radio. Es el único archivo que hace falta tocar.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  stationName: "G2A2 Radio (fase 0)",

  // Client ID de tu app en https://developer.spotify.com/dashboard
  spotifyClientId: "de690f7555fa410c94d10e4dbf8f2efc",

  // Client Access Token de https://genius.com/api-clients (para la info de artistas).
  // Es de solo lectura y queda visible en la web; si se deja vacío se usa solo Wikipedia.
  geniusToken: "0Ccgfkyt3eLku6C-T_bR7hcusRK0lTlY0eLd_Cr8kVFBejCZOK6wBMXPy8B0Uzqc",

  // Tiene que coincidir EXACTAMENTE con una Redirect URI registrada en el dashboard.
  redirectUri: window.location.origin + window.location.pathname.replace(/index\.html$/, ""),

  timezone: "Europe/Madrid",
  // Volumen al entrar (0 a 1). En 0 la radio arranca silenciada y avisa de que hay que subirlo.
  volume: 0,

  // ── Programas ──────────────────────────────────────────────
  // Cada programa es una playlist tuya. "name" y "genres" son lo que sale en la web;
  // el nombre real de la playlist no se muestra nunca (lo tienes en el comentario de cada línea).
  // Moods: neutral | fiesta | melancolia | rabia | calma | electronica | rap | sensual | bar | retro
  programs: {
    miau: { name: "Reggaetón lento", genres: "Reggaetón y trap romántico", id: "0WzJfH2WjkesABkmYAqljV", mood: "sensual" }, // miau.raw
    perdi: { name: "Under night", genres: "Trap español nocturno", id: "4Wd4OoqEUmtI80bYaaGmCW", mood: "melancolia" }, // me perdí en madrid
    sunnyd: { name: "Hip hop al sol", genres: "Hip hop americano", id: "06Rt5YfMAtPYAfFlLXmI0Q", mood: "fiesta" }, // sunnyD
    eurobeat: { name: "Eurobeat", genres: "Eurobeat de los 90", id: "5yJxMqbu9gsBs30NMdbrJ9", mood: "retro" }, // eurobeat
    unloveable: { name: "Pluggnb", genres: "Trap y hip hop americano", id: "6Bj8CL09mOSGjmOIRmqn3h", mood: "melancolia" }, // certified unloveable boy
    cloudrap: { name: "Cloud rap", genres: "Cloud rap en español e inglés", id: "37GhPJZ0NORxzrkCa07EPT", mood: "calma" }, // cloud rap
    tonny: { name: "Ola fría", genres: "Synthpop, new wave y post-punk", id: "57Pc2sngZ3CNQjhgOeWZvl", mood: "melancolia" }, // tonny
    hochill: { name: "Under chill", genres: "Trap underground español", id: "3qNBEdUqNZEH3c4tiX5Wic", mood: "calma" }, // ho chill mint
    diavlo: { name: "Nu metal", genres: "Metal alternativo, nu metal y emo", id: "7w1XSn3S4q1Hf1jxg92xYS", mood: "rabia" }, // el diavlo
    azzaro: { name: "Amor y desamor", genres: "Underground español", id: "37xQUtTMnuW3oJ03b367Vg", mood: "sensual" }, // azzaroMostYearner
    castrati: { name: "Drain", genres: "Drain gang y rap experimental", id: "65vqkKoui17Ve0amj7NpwY", mood: "electronica" }, // castrati
    folk: { name: "Folk y clásica", genres: "Pop folk y música clásica", id: "4cvGxvYym6on124xuDcJjy", mood: "neutral" }, // folk&classic
    jdm: { name: "Midnight drift", genres: "Hyperpop, outsider house y breakcore", id: "7q2cwXkQdztdnC7QckZwN4", mood: "electronica" }, // jdm 90s midnight drift core
    amor: { name: "Flamenco y bolero", genres: "Flamenco y bolero", id: "4MEKAMcXy51bmAFunUI633", mood: "bar" }, // amorSureño
    besitos: { name: "Trap y R&B", genres: "Trap americano y R&B alternativo", id: "6Y5ja1L55yuky0IMElOufc", mood: "rap" }, // trap&besitos
    erotik: { name: "Femme fatale", genres: "R&B y pop sensual", id: "6qQTSB2BViSvKrfpLjM50J", mood: "sensual" }, // erotik
    aux: { name: "Fiesta", genres: "Para darlo todo", id: "2vyWAyWAFoBebKSsbkeR3p", mood: "fiesta" }, // who let him the aux
    europafm: { name: "Pop en inglés", genres: "Pop anglosajón", id: "5KAEOQplnT90eXLxfnDgSy", mood: "fiesta" }, // europa fm
    cowboy: { name: "Rock", genres: "Rock melancólico en inglés", id: "1z83iUcAU88wClD2YMTpSf", mood: "melancolia" }, // see you space cowboy
    toyota: { name: "Ambient", genres: "Electrónica ambient", id: "5UljySkthC3fsKtsDzO2Bz", mood: "calma" }, // toyotaCats
    cave: { name: "Ruido", genres: "Noise y experimental", id: "7Eu2Hp99FuePVsl9OH3A1j", mood: "rabia" }, // head in a cave
    jrock: { name: "Jrock anime", genres: "Rock japonés de anime", id: "2P9agXsWmU8qKp6DgKav5N", mood: "retro" }, // jrock anime
    citypop: { name: "City pop", genres: "City pop en japonés e inglés", id: "5lhWAEpARgLoU2Pp0uYuKq", mood: "retro" }, // city pop
    venus: { name: "Pop español clásico", genres: "Pop español de siempre", id: "0TJ0wvrbQSqOGI3wASuEtX", mood: "retro" }, // barco a venus
    snow: { name: "Electroclash", genres: "Synthpop y electroclash", id: "6Gffa1lmESHlKnAKre1uri", mood: "electronica" }, // 🪬❄️
    n49: { name: "Pop rock japonés", genres: "J-pop y J-rock", id: "4ignUT87oOjPVQGXEnz1y6", mood: "retro" }, // mi lista n49
    daydream: { name: "Dream pop", genres: "Dream pop y dreamgaze", id: "3dVYngnJA5cvUdhCoWTyHI", mood: "calma" }, // dayDreaming
    rester: { name: "Jazz club", genres: "Hot jazz y bebop", id: "3sDgovSnYrBBDzDljXNgpu", mood: "bar" }, // rester's house
    gyaru: { name: "Eurodance", genres: "Eurodance y J-pop gyaru", id: "6tiLeDqT7QB29THUsw5cl6", mood: "retro" }, // eurodance&gyaru
    xulito: { name: "Rap de calle", genres: "Rap y trap en español e inglés", id: "0KJRRT9cvYjdVySrpHex3T", mood: "rap" }, // hotXulito
  },

  // ── Parrilla semanal ───────────────────────────────────────
  // [hora de inicio, programa]. Cada franja dura hasta la siguiente; la última, hasta las 24:00.
  // Horas en punto o y media.
  schedule: {
    lunes: [
      ["00:00", "diavlo"], ["03:00", "cave"], ["07:00", "cloudrap"], ["10:00", "daydream"],
      ["14:00", "besitos"], ["17:00", "xulito"], ["20:00", "miau"], ["22:00", "rester"],
    ],
    martes: [
      ["00:00", "unloveable"], ["02:00", "jdm"], ["07:00", "hochill"], ["10:00", "n49"],
      ["14:00", "azzaro"], ["17:00", "cowboy"], ["20:00", "erotik"], ["22:00", "castrati"],
    ],
    miercoles: [
      ["00:00", "perdi"], ["03:00", "diavlo"], ["07:00", "folk"], ["09:00", "besitos"],
      ["14:00", "sunnyd"], ["17:00", "castrati"], ["20:00", "erotik"], ["22:00", "rester"],
    ],
    jueves: [
      ["00:00", "tonny"], ["03:00", "cave"], ["07:00", "cloudrap"], ["10:00", "cowboy"],
      ["14:00", "europafm"], ["16:00", "jrock"], ["17:30", "xulito"], ["20:00", "miau"], ["22:00", "rester"],
    ],
    viernes: [
      ["00:00", "snow"], ["03:00", "jdm"], ["07:00", "daydream"], ["10:00", "besitos"],
      ["14:00", "sunnyd"], ["17:00", "xulito"], ["19:00", "gyaru"], ["20:00", "erotik"], ["22:00", "aux"],
    ],
    sabado: [
      ["00:00", "aux"], ["03:00", "diavlo"], ["07:00", "europafm"], ["10:00", "citypop"],
      ["14:00", "azzaro"], ["17:00", "xulito"], ["20:00", "eurobeat"], ["22:00", "aux"],
    ],
    domingo: [
      ["00:00", "aux"], ["03:00", "unloveable"], ["05:00", "perdi"], ["07:00", "venus"],
      ["10:00", "daydream"], ["14:00", "amor"], ["17:00", "toyota"], ["19:00", "cowboy"], ["22:00", "rester"],
    ],
  },
};
