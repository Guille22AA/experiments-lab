/* El idioma activo lo decide IDIOMA, una constante global que el HTML
   define antes de cargar este archivo (ver templates/index.html), a partir
   de config.idioma() en el backend. Así un único archivo sirve la copia en
   español y la copia vendible en inglés, sin tocar nada aquí. */
const TEXTOS = {
  es: {
    nombres: { crypto: "CRIPTO", broker: "BRÓKER" },
    cabecera: {
      parar: "Parar bot", activar: "Activar bot",
      sinConexion: "sin conexión con el bot",
      botActivo: "bot activo", botParado: "bot parado",
      ultimaLectura: "últ. lectura ", dosWallets: "las dos wallets · ",
      errorPrefijo: "La última lectura falló en parte — ",
      ariaParar: "Parar el bot", ariaActivar: "Activar el bot",
    },
    grafica: {
      vacio: "Sin datos suficientes todavía.<br>La curva aparece tras unas cuantas lecturas.",
      lecturas: "lecturas", compararMantener: "--- comprar y mantener", minimo: "mín ",
    },
    cubos: {
      vacio: "Todo en efectivo · el bot aún no ha invertido nada",
      nucleo: "Seguro", satelite: "Lotería", objetivo: "objetivo",
    },
    historial: {
      vacio: "Sin operaciones todavía.<br>El bot solo está observando precios.",
      compra: "Compra", venta: "Venta",
      hora: "HORA", tipo: "TIPO", activo: "ACTIVO", importe: "IMPORTE", resultado: "RESULTADO",
    },
    posiciones: {
      vacio: "Sin posiciones abiertas.",
      activo: "ACTIVO", cubo: "CUBO", puesto: "PUESTO", valeAhora: "VALE AHORA", resultado: "RESULTADO",
    },
    precios: { sinDatos: "sin datos" },
    candidatos: {
      vacio: "Sin candidatos todavía. Se actualiza cada hora.",
      nota: "Esto es justo lo que ve el escáner ahora mismo: podrías replicar estas entradas a mano, con dinero real, con estos mismos números.",
      activo: "ACTIVO", precio: "PRECIO", cambio: "24 H", actividad: "ACTIVIDAD",
      enCartera: "ya en cartera",
      actualizado: cuando => `Actualizado ${cuando}`,
    },
    wallet: {
      independiente: "wallet independiente",
      activosBoton: "Activos", activosAria: n => `Activos vigilados en ${n}`,
      ajustesBoton: "Ajustes", ajustesAria: n => `Ajustes de ${n}`,
      diagTitulo: "Esta configuración no puede funcionar del todo",
      sobreAportado: a => `sobre ${a} aportados`,
      reparto: "REPARTO ACTUAL", resumen: "RESUMEN", evolucion: "EVOLUCIÓN",
      historialTitulo: "HISTORIAL", posicionesTitulo: "POSICIONES ABIERTAS", preciosTitulo: "PRECIOS VIGILADOS",
      candidatosTitulo: "CANDIDATOS DEL SATÉLITE AHORA MISMO",
      efectivoNucleo: "Efectivo · cubo seguro", efectivoSatelite: "Efectivo · cubo lotería",
      comisiones: "Comisiones pagadas", intereses: "Intereses del efectivo",
      deslizamiento: "Deslizamiento pagado", plusvalias: "Plusvalías realizadas",
      impuesto: "Impuesto estimado", aciertosFallos: "Aciertos / fallos · lotería",
      reponerEtiqueta: "Cubo lotería: ", reponerObjetivo: o => ` de ${o} objetivo`,
      reponerLlevas: "Llevas ", reponerAviso: " repuestos a mano en este cubo.\n            El bot nunca lo rellena solo.",
      reponerBoton: "Reponer…",
      comparativaTxt: "Frente a comprar y no tocar nada:\n          ",
      comparativaAviso: (total, ref) => `El bot lleva ${total}; sin hacer nada tendrías\n          ${ref}. Con pocas semanas esto no significa nada todavía.`,
      bolsaCerrada: "La bolsa cierra de noche y fines de semana: la curva se queda plana, no es un fallo.",
    },
    reponerPrompt: {
      texto: "¿Cuánto quieres pasar del cubo seguro al cubo lotería?\n\n" +
             "Sale de tu dinero estable y es dinero que puedes perder entero.\n",
      minimo: "Mínimo en esta wallet: ", disponible: "  ·  disponible: ",
      importe: "\n\nImporte en euros:", error: "No se pudo reponer: ",
    },
    ajustesModal: {
      errorCarga: "No se pudieron cargar los ajustes.\n\n",
      errorCargaSufijo: "\n\nSi pone 404, el server.py es de una versión anterior: " +
                        "para el bot con parar.bat y vuelve a arrancarlo.",
      respuestaError: "El servidor respondió ", sinAjustes: "El servidor no devolvió ajustes",
      titulo: n => `Ajustes · ${n}`, cerrar: "Cerrar",
      nota: "Los valores por defecto son un punto de partida razonable, no los mejores: " +
            "nadie los conoce. Cámbialos solo cuando tus datos te den un motivo.",
      dineroNuevo: "Dinero nuevo y efectivo", avanzados: "Ajustes avanzados del cubo lotería",
      notaAvanzados: "Estas son las reglas de salida. Aquí es donde se gana o se pierde de " +
                     "verdad: entrar es fácil, salir a tiempo es el problema.",
      filtrosEntrada: "Filtros de entrada del escáner",
      notaFiltros: "Esto decide qué cuenta como candidato en «Candidatos del satélite ahora " +
                   "mismo». Tócalos y verás cambiar la lista en el próximo escaneo.",
      porDefecto: "Volver a los valores por defecto", cancelar: "Cancelar", guardar: "Guardar",
      confirmarDefecto: "¿Devolver todos los ajustes de esta wallet a sus valores por defecto?",
      rangoFueraDeRango: "Hay valores fuera de rango",
      rango: (min, max, sufijo) => `Entre ${min} y ${max}${sufijo}.`,
      avisoCapado: (pct, total, apuesta, minima) =>
        `Con ${pct} % de ${total}, cada apuesta sería de ${apuesta}, por debajo de la orden ` +
        `mínima de ${minima} en esta wallet. El cubo se quedaría en efectivo sin comprar nada.`,
      avisoSubirReparto: "Subir el reparto NO mete dinero en el cubo lotería. " +
                         "Para eso está el botón «Reponer…».",
      avisoBajarReparto: "Bajar el reparto hará que el bot venda parte del cubo " +
                         "lotería en el próximo ciclo.",
      avisoCobertura: (n, t, cobertura) =>
        `Con ${n} apuestas de como mucho ${t} % cada una, el cubo lotería solo llegaría a ` +
        `invertir el ${cobertura} % de su dinero. El resto se quedaría siempre en efectivo.`,
    },
    campos: {
      repartoLoteria: { etiqueta: "Reparto del cubo lotería",
        ayuda: "Cuánto de esta wallet se juega en lo arriesgado. El resto va al cubo seguro." },
      umbralRebalanceo: { etiqueta: "Margen antes de rebalancear",
        ayuda: "Cuánto tiene que desviarse algo antes de que el bot actúe. Cuanto más bajo, más opera y más comisiones paga." },
      aportacionImporte: { etiqueta: "Aportación periódica",
        ayuda: "Dinero nuevo que entra cada cierto tiempo, como un plan de inversión. Va entero al cubo seguro. En 0 está desactivada." },
      aportacionDias: { etiqueta: "Cada cuántos días", ayuda: "30 equivale a una aportación mensual." },
      interesAnual: { etiqueta: "Interés del efectivo parado",
        ayuda: "Lo que renta al año el dinero sin invertir, como una cuenta remunerada. Se abona de forma continua." },
      stopPerdida: { etiqueta: "Stop de pérdida",
        ayuda: "Si una apuesta cae este porcentaje desde tu precio de entrada, se vende. Más ajustado te saca en cualquier bajón normal." },
      caidaDesdeMaximo: { etiqueta: "Salida por desplome",
        ayuda: "Si algo subió y luego cae esto desde su máximo, se sale aunque siga en ganancias." },
      objetivoParcial: { etiqueta: "Multiplicador de recogida",
        ayuda: "Al alcanzar este múltiplo se vende una parte. Con 2x recuperas lo puesto y el resto corre gratis." },
      fraccionParcial: { etiqueta: "Cuánto se recoge ahí",
        ayuda: "Qué porcentaje de la posición se vende al alcanzar el múltiplo." },
      cuarentenaDias: { etiqueta: "Cuarentena tras cerrar",
        ayuda: "Días que un activo queda vetado tras venderse. Evita recomprar lo que acaba de saltar por stop. En 0 está desactivada." },
      maxPosiciones: { etiqueta: "Apuestas simultáneas",
        ayuda: "Cuántas posiciones puede tener abiertas el cubo lotería a la vez." },
      maxPorPosicion: { etiqueta: "Tamaño máximo por apuesta",
        ayuda: "Cuánto del cubo lotería puede ir a una sola apuesta. Bajo aguanta más fallos seguidos." },
      filtroMcapMinimo: { etiqueta: "Capitalización mínima",
        ayuda: "Por debajo de esto se descarta por microscópico: ni liquidez ni recorrido real." },
      filtroMcapMaximo: { etiqueta: "Capitalización máxima",
        ayuda: "Por encima de esto ya es demasiado grande: no queda margen de subida real." },
      filtroVolumenMinimo: { etiqueta: "Volumen mínimo en 24 h",
        ayuda: "Que se pueda entrar y salir sin mover el precio tú mismo." },
      filtroRatioVolMcap: { etiqueta: "Actividad mínima (volumen / capitalización)",
        ayuda: "Volumen real respecto a su tamaño, no volumen fantasma." },
      filtroRatioVolMedio: { etiqueta: "Volumen sobre su media",
        ayuda: "Cuánto por encima de lo normal tiene que estar el volumen de hoy." },
      filtroSubidaMin: { etiqueta: "Subida mínima en 24 h",
        ayuda: "Por debajo de esto no se considera que algo se esté moviendo." },
      filtroSubidaMax: { etiqueta: "Subida máxima en 24 h",
        ayuda: "Por encima de esto ya ha volado: perseguirlo es comprar lo más caro del momento." },
    },
    activosModal: {
      placeholderId: "id de CoinGecko o ticker de Yahoo", placeholderNombre: "Nombre",
      quitar: "Quitar", quitarActivo: "Quitar activo",
      errorCarga: "No se pudieron cargar los activos.\n\n",
      errorCargaSufijo: "\n\nSi pone 404, el server.py es de una versión anterior: " +
                        "para el bot con parar.bat y vuelve a arrancarlo.",
      sinActivos: "El servidor no devolvió activos",
      titulo: n => `Activos vigilados · ${n}`,
      nota: "Son los activos del cubo seguro: el bot reparte el dinero entre ellos según su " +
            "peso y vigila que no se desvíen. El identificador es el id de CoinGecko para " +
            "cripto (p. ej. «cardano») o el ticker de Yahoo Finance para bróker (p. ej. «AAPL»). " +
            "No se puede quitar uno con una posición abierta.",
      anadir: "+ Añadir activo",
      confirmarDefecto: n => `¿Devolver ${n} a sus activos por defecto?`,
      minimoUno: "Tiene que quedar al menos un activo.",
    },
  },
  en: {
    nombres: { crypto: "CRYPTO", broker: "BROKER" },
    cabecera: {
      parar: "Stop bot", activar: "Start bot",
      sinConexion: "no connection to the bot",
      botActivo: "bot running", botParado: "bot stopped",
      ultimaLectura: "last read ", dosWallets: "both wallets · ",
      errorPrefijo: "The last read partly failed — ",
      ariaParar: "Stop the bot", ariaActivar: "Start the bot",
    },
    grafica: {
      vacio: "Not enough data yet.<br>The chart appears after a few readings.",
      lecturas: "readings", compararMantener: "--- buy and hold", minimo: "min ",
    },
    cubos: {
      vacio: "All in cash · the bot hasn't invested anything yet",
      nucleo: "Core", satelite: "Satellite", objetivo: "target",
    },
    historial: {
      vacio: "No trades yet.<br>The bot is only watching prices.",
      compra: "Buy", venta: "Sell",
      hora: "TIME", tipo: "TYPE", activo: "ASSET", importe: "AMOUNT", resultado: "RESULT",
    },
    posiciones: {
      vacio: "No open positions.",
      activo: "ASSET", cubo: "BUCKET", puesto: "PUT IN", valeAhora: "WORTH NOW", resultado: "RESULT",
    },
    precios: { sinDatos: "no data" },
    candidatos: {
      vacio: "No candidates yet. Updates once an hour.",
      nota: "This is exactly what the scanner sees right now: you could replicate these entries by hand, with real money, using these same numbers.",
      activo: "ASSET", precio: "PRICE", cambio: "24H", actividad: "ACTIVITY",
      enCartera: "already held",
      actualizado: cuando => `Updated ${cuando}`,
    },
    wallet: {
      independiente: "independent wallet",
      activosBoton: "Assets", activosAria: n => `Assets watched in ${n}`,
      ajustesBoton: "Settings", ajustesAria: n => `Settings for ${n}`,
      diagTitulo: "This configuration can't fully work",
      sobreAportado: a => `out of ${a} contributed`,
      reparto: "CURRENT ALLOCATION", resumen: "SUMMARY", evolucion: "PERFORMANCE",
      historialTitulo: "HISTORY", posicionesTitulo: "OPEN POSITIONS", preciosTitulo: "WATCHED PRICES",
      candidatosTitulo: "SATELLITE CANDIDATES RIGHT NOW",
      efectivoNucleo: "Cash · core bucket", efectivoSatelite: "Cash · satellite bucket",
      comisiones: "Fees paid", intereses: "Interest earned",
      deslizamiento: "Slippage paid", plusvalias: "Realized gains",
      impuesto: "Estimated tax", aciertosFallos: "Wins / losses · satellite",
      reponerEtiqueta: "Satellite bucket: ", reponerObjetivo: o => ` of ${o} target`,
      reponerLlevas: "You've topped up ", reponerAviso: " into this bucket by hand.\n            The bot never refills it on its own.",
      reponerBoton: "Top up…",
      comparativaTxt: "Versus buying and holding:\n          ",
      comparativaAviso: (total, ref) => `The bot has ${total}; doing nothing you'd have\n          ${ref}. After just a few weeks this doesn't mean much yet.`,
      bolsaCerrada: "The market closes overnight and on weekends: the line goes flat, that's not a bug.",
    },
    reponerPrompt: {
      texto: "How much do you want to move from the core bucket to the satellite bucket?\n\n" +
             "It comes out of your stable money, and it's money you could lose entirely.\n",
      minimo: "Minimum in this wallet: ", disponible: "  ·  available: ",
      importe: "\n\nAmount in euros:", error: "Couldn't top up: ",
    },
    ajustesModal: {
      errorCarga: "Couldn't load the settings.\n\n",
      errorCargaSufijo: "\n\nIf it says 404, server.py is from an older version: " +
                        "stop the bot with parar.bat and start it again.",
      respuestaError: "The server responded ", sinAjustes: "The server didn't return any settings",
      titulo: n => `Settings · ${n}`, cerrar: "Close",
      nota: "The defaults are a reasonable starting point, not the best ones — nobody knows " +
            "those. Only change them when your own data gives you a reason to.",
      dineroNuevo: "New money and cash", avanzados: "Advanced satellite bucket settings",
      notaAvanzados: "These are the exit rules. This is where you really win or lose: getting " +
                     "in is easy, getting out in time is the hard part.",
      filtrosEntrada: "Scanner entry filters",
      notaFiltros: "This decides what counts as a candidate in \"Satellite candidates right " +
                   "now\". Tweak them and you'll see the list change on the next scan.",
      porDefecto: "Reset to defaults", cancelar: "Cancel", guardar: "Save",
      confirmarDefecto: "Reset all of this wallet's settings to their defaults?",
      rangoFueraDeRango: "Some values are out of range",
      rango: (min, max, sufijo) => `Between ${min} and ${max}${sufijo}.`,
      avisoCapado: (pct, total, apuesta, minima) =>
        `With ${pct}% of ${total}, each bet would be ${apuesta}, below the minimum order of ` +
        `${minima} in this wallet. The bucket would stay in cash without buying anything.`,
      avisoSubirReparto: "Raising the allocation does NOT put money into the satellite bucket. " +
                         "That's what the \"Top up…\" button is for.",
      avisoBajarReparto: "Lowering the allocation will make the bot sell part of the " +
                         "satellite bucket on the next cycle.",
      avisoCobertura: (n, t, cobertura) =>
        `With ${n} bets of at most ${t}% each, the satellite bucket would only ever invest ` +
        `${cobertura}% of its money. The rest would always stay in cash.`,
    },
    campos: {
      repartoLoteria: { etiqueta: "Satellite bucket allocation",
        ayuda: "How much of this wallet is put into the risky side. The rest goes to the core bucket." },
      umbralRebalanceo: { etiqueta: "Margin before rebalancing",
        ayuda: "How far something has to drift before the bot acts. Lower means it trades more and pays more fees." },
      aportacionImporte: { etiqueta: "Recurring contribution",
        ayuda: "New money added on a schedule, like a recurring investment plan. It all goes to the core bucket. At 0 it's disabled." },
      aportacionDias: { etiqueta: "Every how many days", ayuda: "30 is roughly a monthly contribution." },
      interesAnual: { etiqueta: "Interest on idle cash",
        ayuda: "What the uninvested cash earns per year, like an interest-bearing account. It accrues continuously." },
      stopPerdida: { etiqueta: "Stop loss",
        ayuda: "If a bet falls this percentage from your entry price, it's sold. Tighter means you get stopped out by any normal dip." },
      caidaDesdeMaximo: { etiqueta: "Drawdown exit",
        ayuda: "If something rose and then falls this much from its peak, it exits even if it's still in profit." },
      objetivoParcial: { etiqueta: "Profit-taking multiple",
        ayuda: "When this multiple is reached, part of the position is sold. At 2x you recover your stake and the rest runs for free." },
      fraccionParcial: { etiqueta: "How much is taken then",
        ayuda: "What percentage of the position is sold once the multiple is reached." },
      cuarentenaDias: { etiqueta: "Quarantine after closing",
        ayuda: "Days an asset stays blocked after being sold. Stops the bot from immediately rebuying something that just got stopped out. At 0 it's disabled." },
      maxPosiciones: { etiqueta: "Simultaneous bets",
        ayuda: "How many positions the satellite bucket can hold open at once." },
      maxPorPosicion: { etiqueta: "Maximum size per bet",
        ayuda: "How much of the satellite bucket can go into a single bet. Lower survives more losing streaks in a row." },
      filtroMcapMinimo: { etiqueta: "Minimum market cap",
        ayuda: "Below this it's discarded as microscopic: no real liquidity or room to run." },
      filtroMcapMaximo: { etiqueta: "Maximum market cap",
        ayuda: "Above this it's already too big: no real upside room left." },
      filtroVolumenMinimo: { etiqueta: "Minimum 24h volume",
        ayuda: "Enough to get in and out without moving the price yourself." },
      filtroRatioVolMcap: { etiqueta: "Minimum activity (volume / market cap)",
        ayuda: "Real volume relative to its size, not phantom volume." },
      filtroRatioVolMedio: { etiqueta: "Volume over its average",
        ayuda: "How far above normal today's volume has to be." },
      filtroSubidaMin: { etiqueta: "Minimum 24h move",
        ayuda: "Below this, it's not considered to be moving at all." },
      filtroSubidaMax: { etiqueta: "Maximum 24h move",
        ayuda: "Above this it's already flown: chasing it means buying the most expensive moment." },
    },
    activosModal: {
      placeholderId: "CoinGecko id or Yahoo ticker", placeholderNombre: "Name",
      quitar: "Remove", quitarActivo: "Remove asset",
      errorCarga: "Couldn't load the assets.\n\n",
      errorCargaSufijo: "\n\nIf it says 404, server.py is from an older version: " +
                        "stop the bot with parar.bat and start it again.",
      sinActivos: "The server didn't return any assets",
      titulo: n => `Watched assets · ${n}`,
      nota: "These are the core bucket's assets: the bot splits the money between them by " +
            "weight and keeps them from drifting. The identifier is the CoinGecko id for " +
            "crypto (e.g. \"cardano\") or the Yahoo Finance ticker for broker assets " +
            "(e.g. \"AAPL\"). You can't remove one that has an open position.",
      anadir: "+ Add asset",
      confirmarDefecto: n => `Reset ${n} to its default assets?`,
      minimoUno: "At least one asset has to remain.",
    },
  },
};

const T = TEXTOS[typeof IDIOMA !== "undefined" ? IDIOMA : "es"];
const LOCALE = T === TEXTOS.en ? "en-US" : "es-ES";
const NOMBRES = T.nombres;

const ICONO = {
  pausa: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="0.7"/><rect x="7" y="1.5" width="3" height="9" rx="0.7"/></svg>',
  play:  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6 L10 6 L3 10.4 Z"/></svg>',
};

const eur = n =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString(LOCALE, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

const pct = n => (n === null || n === undefined ? "—" : n.toFixed(1) + "%");

/* Clase y triángulo según el signo. Es la pieza que se repite en todas partes. */
function signo(n) {
  if (n === null || n === undefined || Math.abs(n) < 0.005)
    return { clase: "neutro", flecha: "—" };
  return n > 0
    ? { clase: "sube", flecha: "▲" }
    : { clase: "baja", flecha: "▼" };
}

function marca(n, texto) {
  const s = signo(n);
  return `<span class="${s.clase} num"><span class="flecha">${s.flecha}</span>${texto}</span>`;
}

const hora = iso => !iso ? "—" :
  new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });

const fecha = iso => !iso ? "" :
  new Date(iso).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit" });

const fechaHora = iso => !iso ? "—" :
  new Date(iso).toLocaleString(LOCALE, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* --- Gráfica en SVG, sin librerías --------------------------------- */
function grafica(puntos, id) {
  if (!puntos || puntos.length < 2) {
    return `<div class="marco"><div class="vacio">${T.grafica.vacio}</div></div>`;
  }

  const v = puntos.map(p => p.total);
  const ref = puntos.map(p => p.referencia).filter(x => x != null);
  const hayRef = ref.length === v.length;
  const todos = hayRef ? v.concat(ref) : v;
  const min = Math.min(...todos), max = Math.max(...todos);
  const rango = max - min || 1;
  const W = 600, H = 168, m = 10;

  const coords = v.map((x, i) => {
    const px = (i / (v.length - 1)) * (W - m * 2) + m;
    const py = H - m - ((x - min) / rango) * (H - m * 2);
    return [px, py];
  });

  const linea = coords.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");

  let lineaRef = "";
  if (hayRef) {
    lineaRef = ref.map((x, i) => {
      const px = (i / (ref.length - 1)) * (W - m * 2) + m;
      const py = H - m - ((x - min) / rango) * (H - m * 2);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(" ");
  }
  const area = `${m},${H} ${linea} ${W - m},${H}`;

  const sube = v[v.length - 1] >= v[0];
  const color = sube ? "var(--verde)" : "var(--rojo)";
  const ultimo = coords[coords.length - 1];
  const dif = v[v.length - 1] - v[0];
  const difPct = (dif / v[0]) * 100;

  return `<div class="marco">
    <svg class="grafica" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${color}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#g-${id})"></polygon>
      ${lineaRef ? `<polyline points="${lineaRef}" fill="none" stroke="var(--apagado)"
                stroke-width="1.2" stroke-dasharray="4 3" opacity="0.6"></polyline>` : ""}
      <polyline points="${linea}" fill="none" stroke="${color}"
                stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <circle cx="${ultimo[0].toFixed(1)}" cy="${ultimo[1].toFixed(1)}" r="3.2" fill="${color}"></circle>
    </svg>
    <div class="pie-grafica">
      <span>${v.length} ${T.grafica.lecturas}</span>
      ${hayRef ? `<span class="ref-leyenda">${T.grafica.compararMantener}</span>`
               : `<span>${T.grafica.minimo}${eur(min)}</span>`}
      <span>${marca(dif, pct(difPct))}</span>
    </div>
  </div>`;
}

function barraCubos(w) {
  const invertido = w.seguro + w.loteria;
  if (!invertido) {
    return `<div class="cubos"><i class="b-vacio"></i></div>
      <div class="leyenda">${T.cubos.vacio}</div>`;
  }
  const s = (w.seguro / invertido) * 100;
  const l = (w.loteria / invertido) * 100;
  return `<div class="cubos">
      <i class="b-seguro" style="width:${s}%"></i>
      <i class="b-loteria" style="width:${l}%"></i>
    </div>
    <div class="leyenda">
      <span><i class="marca seguro"></i>${T.cubos.nucleo} <b>${pct(s)}</b> · ${T.cubos.objetivo} ${pct(w.reparto_objetivo.seguro)}</span>
      <span><i class="marca loteria"></i>${T.cubos.satelite} <b>${pct(l)}</b> · ${T.cubos.objetivo} ${pct(w.reparto_objetivo.loteria)}</span>
    </div>`;
}

function tablaHistorial(w) {
  if (!w.historial.length) {
    return `<div class="marco"><div class="vacio">${T.historial.vacio}</div></div>`;
  }
  const filas = w.historial.map(o => `<tr class="${o.tipo}" title="${o.motivo || ""}">
      <td class="num"><span class="fecha">${fecha(o.ts)}</span>${hora(o.ts)}</td>
      <td>${o.tipo === "compra" ? T.historial.compra : T.historial.venta}</td>
      <td>${o.simbolo}</td>
      <td class="der num">${eur(o.importe)}</td>
      <td class="der">${o.tipo === "venta" && o.pl_pct !== null ? marca(o.pl_pct, pct(o.pl_pct)) : ""}</td>
    </tr>
    <tr class="motivo-fila"><td colspan="5" class="motivo">${o.motivo || ""}</td></tr>`).join("");
  return `<div class="marco scroll"><table><thead><tr>
      <th>${T.historial.hora}</th><th>${T.historial.tipo}</th><th>${T.historial.activo}</th>
      <th class="der">${T.historial.importe}</th><th class="der">${T.historial.resultado}</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}

function tablaPosiciones(w) {
  if (!w.posiciones.length) {
    return `<div class="marco"><div class="vacio">${T.posiciones.vacio}</div></div>`;
  }
  const filas = w.posiciones.map(p => `<tr>
      <td>${p.simbolo}</td>
      <td>${p.cubo === "loteria" ? T.cubos.satelite : T.cubos.nucleo}</td>
      <td class="der num">${eur(p.importe)}</td>
      <td class="der num">${eur(p.valor_actual)}</td>
      <td class="der">${marca(p.pl_pct, pct(p.pl_pct))}</td>
    </tr>`).join("");
  return `<div class="marco"><table><thead><tr>
      <th>${T.posiciones.activo}</th><th>${T.posiciones.cubo}</th>
      <th class="der">${T.posiciones.puesto}</th><th class="der">${T.posiciones.valeAhora}</th>
      <th class="der">${T.posiciones.resultado}</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}

function tablaPrecios(w) {
  const filas = w.activos.map(a => `<tr>
      <td>${a.nombre}</td>
      <td class="der num">${a.precio ? eur(a.precio) : `<span class="neutro">${T.precios.sinDatos}</span>`}</td>
    </tr>`).join("");
  return `<div class="marco"><table><tbody>${filas}</tbody></table></div>`;
}

function tablaCandidatos(w) {
  if (!w.candidatos.length) {
    return `<div class="marco"><div class="vacio">${T.candidatos.vacio}</div></div>`;
  }
  const filas = w.candidatos.map(c => `<tr>
      <td>${c.simbolo}${c.en_cartera ? ` <span class="neutro">· ${T.candidatos.enCartera}</span>` : ""}</td>
      <td class="der num">${eur(c.precio)}</td>
      <td class="der">${marca(c.cambio, pct(c.cambio))}</td>
      <td class="der num">${c.actividad.toFixed(2)}x</td>
    </tr>`).join("");
  return `<div class="marco scroll"><table><thead><tr>
      <th>${T.candidatos.activo}</th><th class="der">${T.candidatos.precio}</th>
      <th class="der">${T.candidatos.cambio}</th><th class="der">${T.candidatos.actividad}</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}

function pintarWallet(clave, w) {
  const s = signo(w.resultado);
  const pctRes = w.aportado ? (w.resultado / w.aportado) * 100 : 0;
  const cerrado = clave === "broker"
    ? `<div class="aviso">${T.wallet.bolsaCerrada}</div>`
    : "";

  return `
    <header>
      <h2><span class="pip"></span>${NOMBRES[clave]}</h2>
      <div class="cabecera-dcha">
        <span class="etiqueta">${T.wallet.independiente}</span>
        <button class="engranaje" data-activos="${clave}" title="${T.wallet.activosBoton}" aria-label="${T.wallet.activosAria(NOMBRES[clave])}">
          <svg viewBox="0 0 16 16" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.3">
            <circle cx="6.1" cy="6.1" r="4.3"/><circle cx="9.9" cy="9.9" r="4.3"/>
          </svg>
        </button>
        <button class="engranaje" data-ajustes="${clave}" title="${T.wallet.ajustesBoton}" aria-label="${T.wallet.ajustesAria(NOMBRES[clave])}">
          <svg viewBox="0 0 16 16" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round">
            <line x1="2" y1="4" x2="14" y2="4"/><circle cx="10" cy="4" r="1.6" style="fill:currentColor;stroke:none"/>
            <line x1="2" y1="8" x2="14" y2="8"/><circle cx="5.3" cy="8" r="1.6" style="fill:currentColor;stroke:none"/>
            <line x1="2" y1="12" x2="14" y2="12"/><circle cx="11" cy="12" r="1.6" style="fill:currentColor;stroke:none"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="total num ${s.clase}">${eur(w.total)}</div>
    <div class="resultado">
      ${marca(w.resultado, `${eur(w.resultado)} (${pct(pctRes)})`)}
      <span class="neutro">${T.wallet.sobreAportado(eur(w.aportado))}</span>
    </div>

    ${(w.diagnostico || []).length ? `
      <div class="diagnostico">
        <div class="diag-titulo">${T.wallet.diagTitulo}</div>
        ${w.diagnostico.map(t => `<div class="diag-linea">${t}</div>`).join("")}
      </div>` : ""}

    <div class="bloque">
      <h3>${T.wallet.reparto}</h3>
      ${barraCubos(w)}
    </div>

    <div class="bloque">
      <h3>${T.wallet.resumen}</h3>
      <div class="cifras">
        <div class="cifra"><span>${T.wallet.efectivoNucleo}</span><strong class="num">${eur(w.efectivo_seguro)}</strong></div>
        <div class="cifra"><span>${T.wallet.efectivoSatelite}</span><strong class="num">${eur(w.efectivo_loteria)}</strong></div>
        <div class="cifra"><span>${T.wallet.comisiones}</span><strong class="num baja">${eur(w.comisiones)}</strong></div>
        <div class="cifra"><span>${T.wallet.intereses}</span><strong class="num sube">${eur(w.intereses)}</strong></div>
        <div class="cifra"><span>${T.wallet.deslizamiento}</span><strong class="num baja">${eur(w.deslizamiento)}</strong></div>
        <div class="cifra"><span>${T.wallet.plusvalias}</span><strong class="num">${marca(w.plusvalias, eur(w.plusvalias))}</strong></div>
        <div class="cifra"><span>${T.wallet.impuesto}</span><strong class="num baja">${eur(w.impuesto)}</strong></div>
        <div class="cifra"><span>${T.wallet.aciertosFallos}</span><strong class="num"><span class="sube">${w.aciertos}</span> / <span class="baja">${w.fallos}</span></strong></div>
      </div>
      <div class="reponer">
        <div>
          <div class="reponer-txt">${T.wallet.reponerEtiqueta}<b class="num">${eur(w.loteria)}</b>${T.wallet.reponerObjetivo(eur(w.total * w.reparto_objetivo.loteria / 100))}</div>
          <div class="reponer-aviso">${T.wallet.reponerLlevas}<b class="num">${eur(w.repuesto)}</b>${T.wallet.reponerAviso}</div>
        </div>
        <button class="btn-reponer" data-wallet="${clave}">${T.wallet.reponerBoton}</button>
      </div>
    </div>

    ${w.referencia ? `
    <div class="comparativa">
      <div>
        <div class="comp-txt">${T.wallet.comparativaTxt}
          <b>${marca(w.total - w.referencia, eur(w.total - w.referencia))}</b></div>
        <div class="comp-aviso">${T.wallet.comparativaAviso(eur(w.total), eur(w.referencia))}</div>
      </div>
    </div>` : ""}

    <div class="bloque">
      <div class="paralelo">
        <div>
          <h3>${T.wallet.evolucion}</h3>
          ${grafica(w.grafica, clave)}
          ${cerrado}
        </div>
        <div>
          <h3>${T.wallet.historialTitulo}</h3>
          ${tablaHistorial(w)}
        </div>
      </div>
    </div>

    <div class="bloque">
      <div class="paralelo">
        <div>
          <h3>${T.wallet.posicionesTitulo}</h3>
          ${tablaPosiciones(w)}
        </div>
        <div>
          <h3>${T.wallet.preciosTitulo}</h3>
          ${tablaPrecios(w)}
        </div>
      </div>
    </div>

    <div class="bloque">
      <h3>${T.wallet.candidatosTitulo}</h3>
      <p class="modal-nota">${T.candidatos.nota}</p>
      ${tablaCandidatos(w)}
      ${w.candidatos_actualizado ? `<div class="aviso">${T.candidatos.actualizado(fechaHora(w.candidatos_actualizado))}</div>` : ""}
    </div>
  `;
}

let ULTIMO_ESTADO = null;

async function refrescar() {
  let datos;
  try {
    datos = await (await fetch("/api/estado")).json();
  } catch (e) {
    document.getElementById("estado-bot").innerHTML =
      `<span class="punto off"></span>${T.cabecera.sinConexion}`;
    return;
  }

  ULTIMO_ESTADO = datos;
  const dif = datos.total_conjunto - datos.aportado_conjunto;
  const s = signo(dif);
  document.getElementById("conjunto").innerHTML =
    `<span class="${s.clase}">${eur(datos.total_conjunto)}</span>`;
  document.getElementById("conjunto-detalle").innerHTML =
    `${T.cabecera.dosWallets}${marca(dif, eur(dif))}`;

  const activo = datos.bot_activo;
  document.getElementById("estado-bot").innerHTML =
    `<span class="punto ${activo ? "" : "off"}"></span>${activo ? T.cabecera.botActivo : T.cabecera.botParado}`;
  document.getElementById("ultima").textContent = T.cabecera.ultimaLectura + fechaHora(datos.ultima_consulta);

  const btn = document.getElementById("interruptor");
  btn.innerHTML = activo
    ? ICONO.pausa + `<span>${T.cabecera.parar}</span>`
    : ICONO.play + `<span>${T.cabecera.activar}</span>`;
  btn.dataset.activo = activo;
  btn.classList.toggle("en-marcha", activo);
  btn.setAttribute("aria-label", activo ? T.cabecera.ariaParar : T.cabecera.ariaActivar);

  const err = document.getElementById("error");
  if (datos.ultimo_error) {
    err.style.display = "block";
    err.textContent = T.cabecera.errorPrefijo + datos.ultimo_error;
  } else {
    err.style.display = "none";
  }

  for (const clave of ["crypto", "broker"]) {
    const w = datos.wallets[clave];
    if (w) document.getElementById("wallet-" + clave).innerHTML = pintarWallet(clave, w);
  }
}

document.addEventListener("click", async ev => {
  const boton = ev.target.closest(".btn-reponer");
  if (!boton) return;
  const wallet = boton.dataset.wallet;
  const wd = ULTIMO_ESTADO ? ULTIMO_ESTADO.wallets[wallet] : null;
  const minima = wd ? wd.orden_minima : 5;
  const texto = prompt(
    T.reponerPrompt.texto +
    T.reponerPrompt.minimo + `${minima.toFixed(0)} €` +
    (wd ? `${T.reponerPrompt.disponible}${wd.seguro.toFixed(2)} €` : "") +
    T.reponerPrompt.importe, Math.max(minima, 0).toFixed(0));
  if (!texto) return;
  const importe = parseFloat(texto.replace(",", "."));
  if (!(importe > 0)) return;
  const r = await fetch("/api/reponer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, importe }),
  });
  const res = await r.json();
  if (res.error) alert(T.reponerPrompt.error + res.error);
  refrescar();
});

document.getElementById("interruptor").addEventListener("click", async e => {
  const btn = e.currentTarget;
  const activoAhora = btn.dataset.activo === "true";

  // Se bloquea mientras va la petición: sin esto se puede pulsar tres veces
  // seguidas pensando que no responde y acabar en el estado contrario.
  btn.disabled = true;
  try {
    await fetch("/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activoAhora }),
    });
  } finally {
    btn.disabled = false;
  }
  refrescar();
});

refrescar();
setInterval(refrescar, 5000);


/* ==================== PANEL DE AJUSTES ==================== */

const CAMPOS_BASICOS = [
  { campo: "reparto_loteria", etiqueta: T.campos.repartoLoteria.etiqueta, sufijo: "%",
    min: 0, max: 40, paso: 1, ayuda: T.campos.repartoLoteria.ayuda,
    desde: a => a.reparto.loteria * 100 },
  { campo: "umbral_rebalanceo", etiqueta: T.campos.umbralRebalanceo.etiqueta, sufijo: "%",
    min: 1, max: 30, paso: 1, ayuda: T.campos.umbralRebalanceo.ayuda,
    desde: a => a.umbral_rebalanceo * 100 },
];

const CAMPOS_APORTACION = [
  { campo: "aportacion_importe", etiqueta: T.campos.aportacionImporte.etiqueta, sufijo: "€",
    min: 0, max: 100000, paso: 5, ayuda: T.campos.aportacionImporte.ayuda,
    desde: a => a.aportacion_importe },
  { campo: "aportacion_dias", etiqueta: T.campos.aportacionDias.etiqueta, sufijo: "d",
    min: 1, max: 365, paso: 1, ayuda: T.campos.aportacionDias.ayuda,
    desde: a => a.aportacion_dias },
  { campo: "interes_anual", etiqueta: T.campos.interesAnual.etiqueta, sufijo: "%",
    min: 0, max: 20, paso: 0.1, ayuda: T.campos.interesAnual.ayuda,
    desde: a => +(a.interes_anual * 100).toFixed(2) },
];

// Los dos primeros son caídas: se piden en positivo y se guardan en negativo,
// así no hay que escribir signos menos en ningún campo.
const CAMPOS_AVANZADOS = [
  { campo: "stop_perdida", etiqueta: T.campos.stopPerdida.etiqueta, sufijo: "%", magnitud: true,
    min: 5, max: 80, paso: 1, ayuda: T.campos.stopPerdida.ayuda,
    desde: a => Math.abs(a.stop_perdida) },
  { campo: "caida_desde_maximo", etiqueta: T.campos.caidaDesdeMaximo.etiqueta, sufijo: "%", magnitud: true,
    min: 10, max: 90, paso: 1, ayuda: T.campos.caidaDesdeMaximo.ayuda,
    desde: a => Math.abs(a.caida_desde_maximo) },
  { campo: "objetivo_parcial", etiqueta: T.campos.objetivoParcial.etiqueta, sufijo: "x",
    min: 1.2, max: 10, paso: 0.1, ayuda: T.campos.objetivoParcial.ayuda,
    desde: a => a.objetivo_parcial },
  { campo: "fraccion_parcial", etiqueta: T.campos.fraccionParcial.etiqueta, sufijo: "%",
    min: 10, max: 100, paso: 5, ayuda: T.campos.fraccionParcial.ayuda,
    desde: a => a.fraccion_parcial * 100 },
  { campo: "cuarentena_dias", etiqueta: T.campos.cuarentenaDias.etiqueta, sufijo: "d",
    min: 0, max: 90, paso: 1, ayuda: T.campos.cuarentenaDias.ayuda,
    desde: a => a.cuarentena_dias },
  { campo: "max_posiciones", etiqueta: T.campos.maxPosiciones.etiqueta, sufijo: "",
    min: 1, max: 20, paso: 1, ayuda: T.campos.maxPosiciones.ayuda,
    desde: a => a.max_posiciones },
  { campo: "max_por_posicion", etiqueta: T.campos.maxPorPosicion.etiqueta, sufijo: "%",
    min: 5, max: 100, paso: 5, ayuda: T.campos.maxPorPosicion.ayuda,
    desde: a => a.max_por_posicion * 100 },
];

// Los filtros de entrada cambian según la wallet: cripto tiene capitalización,
// bróker no la tiene y en cambio mira el volumen contra su propia media.
function camposFiltros(wallet) {
  const subida = [
    { campo: "filtro_subida_min", etiqueta: T.campos.filtroSubidaMin.etiqueta, sufijo: "%",
      min: 0, max: 100, paso: 1, ayuda: T.campos.filtroSubidaMin.ayuda,
      desde: a => a.filtro_subida_min },
    { campo: "filtro_subida_max", etiqueta: T.campos.filtroSubidaMax.etiqueta, sufijo: "%",
      min: 0, max: 300, paso: 1, ayuda: T.campos.filtroSubidaMax.ayuda,
      desde: a => a.filtro_subida_max },
  ];
  if (wallet === "crypto") {
    return [
      { campo: "filtro_mcap_minimo", etiqueta: T.campos.filtroMcapMinimo.etiqueta, sufijo: "€",
        min: 0, max: 1000000000, paso: 1000000, ayuda: T.campos.filtroMcapMinimo.ayuda,
        desde: a => a.filtro_mcap_minimo },
      { campo: "filtro_mcap_maximo", etiqueta: T.campos.filtroMcapMaximo.etiqueta, sufijo: "€",
        min: 1000000, max: 100000000000, paso: 100000000, ayuda: T.campos.filtroMcapMaximo.ayuda,
        desde: a => a.filtro_mcap_maximo },
      { campo: "filtro_volumen_minimo", etiqueta: T.campos.filtroVolumenMinimo.etiqueta, sufijo: "€",
        min: 0, max: 1000000000, paso: 100000, ayuda: T.campos.filtroVolumenMinimo.ayuda,
        desde: a => a.filtro_volumen_minimo },
      { campo: "filtro_ratio_vol_mcap", etiqueta: T.campos.filtroRatioVolMcap.etiqueta, sufijo: "",
        min: 0, max: 2, paso: 0.01, ayuda: T.campos.filtroRatioVolMcap.ayuda,
        desde: a => a.filtro_ratio_vol_mcap },
      ...subida,
    ];
  }
  return [
    { campo: "filtro_volumen_minimo", etiqueta: T.campos.filtroVolumenMinimo.etiqueta, sufijo: "€",
      min: 0, max: 1000000000, paso: 100000, ayuda: T.campos.filtroVolumenMinimo.ayuda,
      desde: a => a.filtro_volumen_minimo },
    { campo: "filtro_ratio_vol_medio", etiqueta: T.campos.filtroRatioVolMedio.etiqueta, sufijo: "x",
      min: 0.1, max: 10, paso: 0.1, ayuda: T.campos.filtroRatioVolMedio.ayuda,
      desde: a => a.filtro_ratio_vol_medio },
    ...subida,
  ];
}

function fila(def, ajustes) {
  const rango = T.ajustesModal.rango(def.min, def.max, def.sufijo);
  // Si por lo que sea faltara el ajuste, se muestra el mínimo en vez de
  // dejar el campo vacío, que impediría guardar sin explicar por qué.
  let valor;
  try { valor = def.desde(ajustes); } catch (e) { valor = undefined; }
  if (valor === undefined || valor === null || isNaN(valor)) valor = def.min;
  return `<label class="ajuste">
    <div class="ajuste-txt">
      <span class="ajuste-nombre">${def.etiqueta}</span>
      <span class="ajuste-ayuda">${def.ayuda} <span class="rango">${rango}</span></span>
    </div>
    <div class="ajuste-input">
      <input type="number" name="${def.campo}"
             min="${def.min}" max="${def.max}" step="${def.paso}"
             data-magnitud="${def.magnitud ? 1 : 0}"
             value="${valor}">
      <span class="sufijo">${def.sufijo}</span>
    </div>
  </label>`;
}

async function abrirAjustes(wallet) {
  let ajustes;
  try {
    const r = await fetch(`/api/ajustes/${wallet}`);
    if (!r.ok) throw new Error(T.ajustesModal.respuestaError + r.status);
    ({ ajustes } = await r.json());
    if (!ajustes) throw new Error(T.ajustesModal.sinAjustes);
  } catch (e) {
    alert(T.ajustesModal.errorCarga + e.message + T.ajustesModal.errorCargaSufijo);
    return;
  }

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  // Estilos mínimos en línea: si el CSS no cargara, el modal seguiría siendo
  // visible y usable en lugar de quedarse suelto al final de la página.
  fondo.style.cssText =
    "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;" +
    "justify-content:center;padding:24px;background:rgba(5,6,14,.72)";
  fondo.innerHTML = `
    <div class="modal" role="dialog" aria-label="${T.ajustesModal.titulo(NOMBRES[wallet])}">
      <div class="modal-cabecera">
        <h3>${T.ajustesModal.titulo(NOMBRES[wallet])}</h3>
        <button class="cerrar" aria-label="${T.ajustesModal.cerrar}">✕</button>
      </div>
      <div class="modal-cuerpo">
        <p class="modal-nota">${T.ajustesModal.nota}</p>

        ${CAMPOS_BASICOS.map(d => fila(d, ajustes)).join("")}

        <details class="avanzado">
          <summary>${T.ajustesModal.dineroNuevo}</summary>
          ${CAMPOS_APORTACION.map(d => fila(d, ajustes)).join("")}
        </details>

        <details class="avanzado">
          <summary>${T.ajustesModal.avanzados}</summary>
          <p class="modal-nota">${T.ajustesModal.notaAvanzados}</p>
          ${CAMPOS_AVANZADOS.map(d => fila(d, ajustes)).join("")}
        </details>

        <details class="avanzado">
          <summary>${T.ajustesModal.filtrosEntrada}</summary>
          <p class="modal-nota">${T.ajustesModal.notaFiltros}</p>
          ${camposFiltros(wallet).map(d => fila(d, ajustes)).join("")}
        </details>

        <div class="modal-aviso" id="aviso-reparto" style="display:none"></div>
      </div>
      <div class="modal-pie">
        <button class="por-defecto">${T.ajustesModal.porDefecto}</button>
        <div class="modal-acciones">
          <button class="cancelar">${T.ajustesModal.cancelar}</button>
          <button class="guardar destacado">${T.ajustesModal.guardar}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(fondo);
  const modal = fondo.querySelector(".modal");
  modal.style.cssText =
    "background:#14162a;color:#e9eaf6;border:1px solid #292c4c;border-radius:5px;" +
    "width:min(560px,100%);max-height:88vh;display:flex;flex-direction:column";
  const cerrar = () => fondo.remove();

  // Avisar si cambiar el reparto va a provocar operaciones inmediatas.
  const wd = ULTIMO_ESTADO ? ULTIMO_ESTADO.wallets[wallet] : null;
  const minima = wd ? wd.orden_minima : 5;
  const total = wd ? wd.total : 0;

  const inputReparto = modal.querySelector('input[name="reparto_loteria"]');
  const inputTamano = modal.querySelector('input[name="max_por_posicion"]');
  const original = parseFloat(inputReparto.value);
  const aviso = modal.querySelector("#aviso-reparto");

  function revisarReparto() {
    const nuevo = parseFloat(inputReparto.value);
    const tam = parseFloat(inputTamano.value) / 100;
    const mensajes = [];

    if (!isNaN(nuevo) && nuevo > 0 && total > 0) {
      const apuesta = total * (nuevo / 100) * tam;
      if (apuesta < minima) {
        // Lo importante: decir por qué no va a pasar nada, con números.
        mensajes.push(T.ajustesModal.avisoCapado(nuevo, eur(total), eur(apuesta), eur(minima)));
      }
    }
    if (!isNaN(nuevo) && nuevo > original) {
      mensajes.push(T.ajustesModal.avisoSubirReparto);
    } else if (!isNaN(nuevo) && nuevo < original) {
      mensajes.push(T.ajustesModal.avisoBajarReparto);
    }

    aviso.style.display = mensajes.length ? "block" : "none";
    aviso.innerHTML = mensajes.map(m => `<div>${m}</div>`).join("");
  }

  inputReparto.addEventListener("input", revisarReparto);
  if (inputTamano) inputTamano.addEventListener("input", revisarReparto);

  fondo.addEventListener("click", e => { if (e.target === fondo) cerrar(); });
  modal.querySelector(".cerrar").onclick = cerrar;
  modal.querySelector(".cancelar").onclick = cerrar;

  modal.querySelector(".por-defecto").onclick = async () => {
    if (!confirm(T.ajustesModal.confirmarDefecto)) return;
    await fetch(`/api/ajustes/${wallet}/defecto`, { method: "POST" });
    cerrar(); refrescar();
  };

  // Validación en vivo: marca en rojo lo que se sale de rango y desactiva
  // el guardado, en vez de dejar guardar y recortar en silencio.
  const botonGuardar = modal.querySelector(".guardar");
  const entradas = [...modal.querySelectorAll("input[name]")];

  function revisar() {
    let malos = 0;
    entradas.forEach(i => {
      const v = parseFloat(i.value);
      const min = parseFloat(i.min), max = parseFloat(i.max);
      const mal = isNaN(v) || v < min || v > max;
      i.classList.toggle("invalido", mal);
      if (mal) malos++;
    });
    botonGuardar.disabled = malos > 0;
    botonGuardar.title = malos ? T.ajustesModal.rangoFueraDeRango : "";
  }
  // El atributo min de HTML marca el campo como inválido, pero no impide
  // teclear ni bajar con las flechas. Hay que sujetarlo desde aquí.
  entradas.forEach(i => {
    const min = parseFloat(i.min), max = parseFloat(i.max);

    // Ni signo menos ni notación exponencial: ningún ajuste los admite.
    i.addEventListener("keydown", ev => {
      if (["-", "+", "e", "E"].includes(ev.key)) ev.preventDefault();
    });

    // Pegar texto con signo o basura tampoco cuela.
    i.addEventListener("paste", ev => {
      const texto = (ev.clipboardData || window.clipboardData).getData("text");
      if (!/^\d*[.,]?\d*$/.test(texto.trim())) ev.preventDefault();
    });

    // Las flechas del teclado y los botones del campo pasan por aquí:
    // se recorta al instante en vez de dejar bajar sin freno.
    const sujetar = () => {
      const v = parseFloat(i.value);
      if (isNaN(v)) return;
      if (v < min) i.value = min;
      if (v > max) i.value = max;
    };
    i.addEventListener("change", sujetar);
    i.addEventListener("input", () => {
      const v = parseFloat(i.value);
      // Mientras se teclea no se recorta por arriba (escribir "40" pasa por
      // "4"), pero por abajo sí: un negativo nunca es un paso intermedio.
      if (!isNaN(v) && v < min) i.value = min;
      revisar();
    });
    i.addEventListener("blur", () => { sujetar(); revisar(); });
  });
  revisar();

  botonGuardar.onclick = async ev => {
    ev.target.disabled = true;
    const datos = {};
    entradas.forEach(i => {
      let v = parseFloat(i.value);
      if (isNaN(v)) return;
      // Los campos de caída se piden en positivo y se guardan en negativo.
      if (i.dataset.magnitud === "1") v = -Math.abs(v);
      datos[i.name] = v;
    });
    const res = await (await fetch(`/api/ajustes/${wallet}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })).json();
    if (res.avisos && res.avisos.length) alert(res.avisos.join("\n"));
    cerrar(); refrescar();
  };

  // Aviso suave de incoherencia: si el cubo nunca puede llegar a invertirse
  // del todo, no es un error pero conviene saberlo.
  const avisoCoherencia = () => {
    const n = parseFloat(modal.querySelector('[name="max_posiciones"]').value);
    const t = parseFloat(modal.querySelector('[name="max_por_posicion"]').value);
    const cobertura = n * t;
    if (!isNaN(cobertura) && cobertura < 100) {
      aviso.style.display = "block";
      aviso.textContent = T.ajustesModal.avisoCobertura(n, t, cobertura.toFixed(0));
    }
  };
  ["max_posiciones", "max_por_posicion"].forEach(n => {
    const el = modal.querySelector(`[name="${n}"]`);
    if (el) el.addEventListener("input", avisoCoherencia);
  });

  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { cerrar(); document.removeEventListener("keydown", esc); }
  });
}

document.addEventListener("click", ev => {
  const boton = ev.target.closest("[data-ajustes]");
  if (boton) abrirAjustes(boton.dataset.ajustes);
});


/* ==================== PANEL DE ACTIVOS (cubo seguro) ==================== */

function filaActivo(a = {}) {
  return `<div class="activos-fila">
    <input class="simbolo" type="text" placeholder="BTC" maxlength="10" value="${a.simbolo || ""}">
    <input class="id-fuente" type="text" placeholder="${T.activosModal.placeholderId}" value="${a.id || ""}">
    <input class="nombre" type="text" placeholder="${T.activosModal.placeholderNombre}" value="${a.nombre || ""}">
    <input class="peso" type="number" min="0.1" max="10" step="0.1" value="${a.peso ?? 1}">
    <button class="activos-quitar" type="button" title="${T.activosModal.quitar}" aria-label="${T.activosModal.quitarActivo}">✕</button>
  </div>`;
}

async function abrirActivos(wallet) {
  let activos;
  try {
    const r = await fetch(`/api/activos/${wallet}`);
    if (!r.ok) throw new Error(T.ajustesModal.respuestaError + r.status);
    ({ activos } = await r.json());
    if (!activos) throw new Error(T.activosModal.sinActivos);
  } catch (e) {
    alert(T.activosModal.errorCarga + e.message + T.activosModal.errorCargaSufijo);
    return;
  }

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.style.cssText =
    "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;" +
    "justify-content:center;padding:24px;background:rgba(5,6,14,.72)";
  fondo.innerHTML = `
    <div class="modal" role="dialog" aria-label="${T.activosModal.titulo(NOMBRES[wallet])}">
      <div class="modal-cabecera">
        <h3>${T.activosModal.titulo(NOMBRES[wallet])}</h3>
        <button class="cerrar" aria-label="${T.ajustesModal.cerrar}">✕</button>
      </div>
      <div class="modal-cuerpo">
        <p class="modal-nota">${T.activosModal.nota}</p>
        <div class="activos-lista">
          ${activos.map(a => filaActivo(a)).join("")}
        </div>
        <button type="button" class="activos-anadir">${T.activosModal.anadir}</button>
        <div class="modal-aviso" id="aviso-activos" style="display:none"></div>
      </div>
      <div class="modal-pie">
        <button class="por-defecto">${T.ajustesModal.porDefecto}</button>
        <div class="modal-acciones">
          <button class="cancelar">${T.ajustesModal.cancelar}</button>
          <button class="guardar destacado">${T.ajustesModal.guardar}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(fondo);
  const modal = fondo.querySelector(".modal");
  modal.style.cssText =
    "background:#14162a;color:#e9eaf6;border:1px solid #292c4c;border-radius:5px;" +
    "width:min(620px,100%);max-height:88vh;display:flex;flex-direction:column";
  const cerrar = () => fondo.remove();
  const lista = modal.querySelector(".activos-lista");
  const aviso = modal.querySelector("#aviso-activos");

  const mostrarError = msg => { aviso.style.display = "block"; aviso.textContent = msg; };
  const ocultarError = () => { aviso.style.display = "none"; };

  lista.addEventListener("click", ev => {
    const boton = ev.target.closest(".activos-quitar");
    if (boton) boton.closest(".activos-fila").remove();
  });

  modal.querySelector(".activos-anadir").onclick = () => {
    lista.insertAdjacentHTML("beforeend", filaActivo());
  };

  fondo.addEventListener("click", e => { if (e.target === fondo) cerrar(); });
  modal.querySelector(".cerrar").onclick = cerrar;
  modal.querySelector(".cancelar").onclick = cerrar;

  modal.querySelector(".por-defecto").onclick = async () => {
    if (!confirm(T.activosModal.confirmarDefecto(NOMBRES[wallet]))) return;
    const res = await (await fetch(`/api/activos/${wallet}/defecto`, { method: "POST" })).json();
    if (res.error) { mostrarError(res.error); return; }
    cerrar(); refrescar();
  };

  modal.querySelector(".guardar").onclick = async ev => {
    const filas = [...lista.querySelectorAll(".activos-fila")];
    if (!filas.length) { mostrarError(T.activosModal.minimoUno); return; }

    const datos = filas.map(f => ({
      simbolo: f.querySelector(".simbolo").value,
      id: f.querySelector(".id-fuente").value,
      nombre: f.querySelector(".nombre").value,
      peso: parseFloat(f.querySelector(".peso").value) || 1,
    }));

    ev.target.disabled = true;
    ocultarError();
    let res;
    try {
      res = await (await fetch(`/api/activos/${wallet}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activos: datos }),
      })).json();
    } finally {
      ev.target.disabled = false;
    }
    // Si algo no vale (id que no existe, símbolo repetido, posición abierta…)
    // se deja el modal abierto con el motivo, en vez de cerrar y perder lo escrito.
    if (res.error) { mostrarError(res.error); return; }
    cerrar(); refrescar();
  };

  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { cerrar(); document.removeEventListener("keydown", esc); }
  });
}

document.addEventListener("click", ev => {
  const boton = ev.target.closest("[data-activos]");
  if (boton) abrirActivos(boton.dataset.activos);
});
