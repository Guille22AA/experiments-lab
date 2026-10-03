const NOMBRES = { crypto: "CRIPTO", broker: "BRÓKER" };

const ICONO = {
  pausa: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="0.7"/><rect x="7" y="1.5" width="3" height="9" rx="0.7"/></svg>',
  play:  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6 L10 6 L3 10.4 Z"/></svg>',
};

const eur = n =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

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
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

const fecha = iso => !iso ? "" :
  new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

const fechaHora = iso => !iso ? "—" :
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* --- Gráfica en SVG, sin librerías --------------------------------- */
function grafica(puntos, id) {
  if (!puntos || puntos.length < 2) {
    return `<div class="marco"><div class="vacio">
      Sin datos suficientes todavía.<br>La curva aparece tras unas cuantas lecturas.
    </div></div>`;
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
      <span>${v.length} lecturas</span>
      ${hayRef ? '<span class="ref-leyenda">--- comprar y mantener</span>'
               : `<span>mín ${eur(min)}</span>`}
      <span>${marca(dif, pct(difPct))}</span>
    </div>
  </div>`;
}

function barraCubos(w) {
  const invertido = w.seguro + w.loteria;
  if (!invertido) {
    return `<div class="cubos"><i class="b-vacio"></i></div>
      <div class="leyenda">Todo en efectivo · el bot aún no ha invertido nada</div>`;
  }
  const s = (w.seguro / invertido) * 100;
  const l = (w.loteria / invertido) * 100;
  return `<div class="cubos">
      <i class="b-seguro" style="width:${s}%"></i>
      <i class="b-loteria" style="width:${l}%"></i>
    </div>
    <div class="leyenda">
      <span><i class="marca seguro"></i>Seguro <b>${pct(s)}</b> · objetivo ${pct(w.reparto_objetivo.seguro)}</span>
      <span><i class="marca loteria"></i>Lotería <b>${pct(l)}</b> · objetivo ${pct(w.reparto_objetivo.loteria)}</span>
    </div>`;
}

function tablaHistorial(w) {
  if (!w.historial.length) {
    return `<div class="marco"><div class="vacio">
      Sin operaciones todavía.<br>El bot solo está observando precios.
    </div></div>`;
  }
  const filas = w.historial.map(o => `<tr class="${o.tipo}" title="${o.motivo || ""}">
      <td class="num"><span class="fecha">${fecha(o.ts)}</span>${hora(o.ts)}</td>
      <td>${o.tipo === "compra" ? "Compra" : "Venta"}</td>
      <td>${o.simbolo}</td>
      <td class="der num">${eur(o.importe)}</td>
      <td class="der">${o.tipo === "venta" && o.pl_pct !== null ? marca(o.pl_pct, pct(o.pl_pct)) : ""}</td>
    </tr>
    <tr class="motivo-fila"><td colspan="5" class="motivo">${o.motivo || ""}</td></tr>`).join("");
  return `<div class="marco scroll"><table><thead><tr>
      <th>HORA</th><th>TIPO</th><th>ACTIVO</th><th class="der">IMPORTE</th><th class="der">RESULTADO</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}

function tablaPosiciones(w) {
  if (!w.posiciones.length) {
    return `<div class="marco"><div class="vacio">Sin posiciones abiertas.</div></div>`;
  }
  const filas = w.posiciones.map(p => `<tr>
      <td>${p.simbolo}</td>
      <td>${p.cubo === "loteria" ? "Lotería" : "Seguro"}</td>
      <td class="der num">${eur(p.importe)}</td>
      <td class="der num">${eur(p.valor_actual)}</td>
      <td class="der">${marca(p.pl_pct, pct(p.pl_pct))}</td>
    </tr>`).join("");
  return `<div class="marco"><table><thead><tr>
      <th>ACTIVO</th><th>CUBO</th><th class="der">PUESTO</th><th class="der">VALE AHORA</th><th class="der">RESULTADO</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}

function tablaPrecios(w) {
  const filas = w.activos.map(a => `<tr>
      <td>${a.nombre}</td>
      <td class="der num">${a.precio ? eur(a.precio) : '<span class="neutro">sin datos</span>'}</td>
    </tr>`).join("");
  return `<div class="marco"><table><tbody>${filas}</tbody></table></div>`;
}

function pintarWallet(clave, w) {
  const s = signo(w.resultado);
  const pctRes = w.aportado ? (w.resultado / w.aportado) * 100 : 0;
  const cerrado = clave === "broker"
    ? '<div class="aviso">La bolsa cierra de noche y fines de semana: la curva se queda plana, no es un fallo.</div>'
    : "";

  return `
    <header>
      <h2><span class="pip"></span>${NOMBRES[clave]}</h2>
      <div class="cabecera-dcha">
        <span class="etiqueta">wallet independiente</span>
        <button class="engranaje" data-activos="${clave}" title="Activos" aria-label="Activos vigilados en ${NOMBRES[clave]}">
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3.2" width="12" height="1.8" rx="0.9"/><rect x="2" y="7.1" width="12" height="1.8" rx="0.9"/><rect x="2" y="11" width="12" height="1.8" rx="0.9"/></svg>
        </button>
        <button class="engranaje" data-ajustes="${clave}" title="Ajustes" aria-label="Ajustes de ${NOMBRES[clave]}">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6zm0 4.4a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2z"/><path d="M13.9 9.3l-1-.6a5.9 5.9 0 000-1.4l1-.6a.6.6 0 00.2-.8l-1.2-2a.6.6 0 00-.8-.2l-1 .6a5.6 5.6 0 00-1.2-.7v-1.2a.6.6 0 00-.6-.6h-2.4a.6.6 0 00-.6.6v1.2c-.4.2-.8.4-1.2.7l-1-.6a.6.6 0 00-.8.2l-1.2 2a.6.6 0 00.2.8l1 .6a5.9 5.9 0 000 1.4l-1 .6a.6.6 0 00-.2.8l1.2 2a.6.6 0 00.8.2l1-.6c.4.3.8.5 1.2.7v1.2c0 .3.3.6.6.6h2.4a.6.6 0 00.6-.6v-1.2c.4-.2.8-.4 1.2-.7l1 .6a.6.6 0 00.8-.2l1.2-2a.6.6 0 00-.2-.8z"/></svg>
        </button>
      </div>
    </header>

    <div class="total num ${s.clase}">${eur(w.total)}</div>
    <div class="resultado">
      ${marca(w.resultado, `${eur(w.resultado)} (${pct(pctRes)})`)}
      <span class="neutro">sobre ${eur(w.aportado)} aportados</span>
    </div>

    ${(w.diagnostico || []).length ? `
      <div class="diagnostico">
        <div class="diag-titulo">Esta configuración no puede funcionar del todo</div>
        ${w.diagnostico.map(t => `<div class="diag-linea">${t}</div>`).join("")}
      </div>` : ""}

    <div class="bloque">
      <h3>REPARTO ACTUAL</h3>
      ${barraCubos(w)}
    </div>

    <div class="bloque">
      <h3>RESUMEN</h3>
      <div class="cifras">
        <div class="cifra"><span>Efectivo · cubo seguro</span><strong class="num">${eur(w.efectivo_seguro)}</strong></div>
        <div class="cifra"><span>Efectivo · cubo lotería</span><strong class="num">${eur(w.efectivo_loteria)}</strong></div>
        <div class="cifra"><span>Comisiones pagadas</span><strong class="num baja">${eur(w.comisiones)}</strong></div>
        <div class="cifra"><span>Intereses del efectivo</span><strong class="num sube">${eur(w.intereses)}</strong></div>
        <div class="cifra"><span>Deslizamiento pagado</span><strong class="num baja">${eur(w.deslizamiento)}</strong></div>
        <div class="cifra"><span>Plusvalías realizadas</span><strong class="num">${marca(w.plusvalias, eur(w.plusvalias))}</strong></div>
        <div class="cifra"><span>Impuesto estimado</span><strong class="num baja">${eur(w.impuesto)}</strong></div>
        <div class="cifra"><span>Aciertos / fallos · lotería</span><strong class="num"><span class="sube">${w.aciertos}</span> / <span class="baja">${w.fallos}</span></strong></div>
      </div>
      <div class="reponer">
        <div>
          <div class="reponer-txt">Cubo lotería: <b class="num">${eur(w.loteria)}</b>
            de ${eur(w.total * w.reparto_objetivo.loteria / 100)} objetivo</div>
          <div class="reponer-aviso">Llevas <b class="num">${eur(w.repuesto)}</b> repuestos a mano en este cubo.
            El bot nunca lo rellena solo.</div>
        </div>
        <button class="btn-reponer" data-wallet="${clave}">Reponer…</button>
      </div>
    </div>

    ${w.referencia ? `
    <div class="comparativa">
      <div>
        <div class="comp-txt">Frente a comprar y no tocar nada:
          <b>${marca(w.total - w.referencia, eur(w.total - w.referencia))}</b></div>
        <div class="comp-aviso">El bot lleva ${eur(w.total)}; sin hacer nada tendrías
          ${eur(w.referencia)}. Con pocas semanas esto no significa nada todavía.</div>
      </div>
    </div>` : ""}

    <div class="bloque">
      <div class="paralelo">
        <div>
          <h3>EVOLUCIÓN</h3>
          ${grafica(w.grafica, clave)}
          ${cerrado}
        </div>
        <div>
          <h3>HISTORIAL</h3>
          ${tablaHistorial(w)}
        </div>
      </div>
    </div>

    <div class="bloque">
      <div class="paralelo">
        <div>
          <h3>POSICIONES ABIERTAS</h3>
          ${tablaPosiciones(w)}
        </div>
        <div>
          <h3>PRECIOS VIGILADOS</h3>
          ${tablaPrecios(w)}
        </div>
      </div>
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
      '<span class="punto off"></span>sin conexión con el bot';
    return;
  }

  ULTIMO_ESTADO = datos;
  const dif = datos.total_conjunto - datos.aportado_conjunto;
  const s = signo(dif);
  document.getElementById("conjunto").innerHTML =
    `<span class="${s.clase}">${eur(datos.total_conjunto)}</span>`;
  document.getElementById("conjunto-detalle").innerHTML =
    `las dos wallets · ${marca(dif, eur(dif))}`;

  const activo = datos.bot_activo;
  document.getElementById("estado-bot").innerHTML =
    `<span class="punto ${activo ? "" : "off"}"></span>${activo ? "bot activo" : "bot parado"}`;
  document.getElementById("ultima").textContent = "últ. lectura " + fechaHora(datos.ultima_consulta);

  const btn = document.getElementById("interruptor");
  btn.innerHTML = activo
    ? ICONO.pausa + "<span>Parar bot</span>"
    : ICONO.play + "<span>Activar bot</span>";
  btn.dataset.activo = activo;
  btn.classList.toggle("en-marcha", activo);
  btn.setAttribute("aria-label", activo ? "Parar el bot" : "Activar el bot");

  const err = document.getElementById("error");
  if (datos.ultimo_error) {
    err.style.display = "block";
    err.textContent = "La última lectura falló en parte — " + datos.ultimo_error;
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
    "¿Cuánto quieres pasar del cubo seguro al cubo lotería?\n\n" +
    "Sale de tu dinero estable y es dinero que puedes perder entero.\n" +
    `Mínimo en esta wallet: ${minima.toFixed(0)} €` +
    (wd ? `  ·  disponible: ${wd.seguro.toFixed(2)} €` : "") +
    "\n\nImporte en euros:", Math.max(minima, 0).toFixed(0));
  if (!texto) return;
  const importe = parseFloat(texto.replace(",", "."));
  if (!(importe > 0)) return;
  const r = await fetch("/api/reponer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, importe }),
  });
  const res = await r.json();
  if (res.error) alert("No se pudo reponer: " + res.error);
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
  { campo: "reparto_loteria", etiqueta: "Reparto del cubo lotería", sufijo: "%",
    min: 0, max: 40, paso: 1,
    ayuda: "Cuánto de esta wallet se juega en lo arriesgado. El resto va al cubo seguro.",
    desde: a => a.reparto.loteria * 100 },
  { campo: "umbral_rebalanceo", etiqueta: "Margen antes de rebalancear", sufijo: "%",
    min: 1, max: 30, paso: 1,
    ayuda: "Cuánto tiene que desviarse algo antes de que el bot actúe. Cuanto más bajo, más opera y más comisiones paga.",
    desde: a => a.umbral_rebalanceo * 100 },
];

const CAMPOS_APORTACION = [
  { campo: "aportacion_importe", etiqueta: "Aportación periódica", sufijo: "€",
    min: 0, max: 100000, paso: 5,
    ayuda: "Dinero nuevo que entra cada cierto tiempo, como un plan de inversión. Va entero al cubo seguro. En 0 está desactivada.",
    desde: a => a.aportacion_importe },
  { campo: "aportacion_dias", etiqueta: "Cada cuántos días", sufijo: "d",
    min: 1, max: 365, paso: 1,
    ayuda: "30 equivale a una aportación mensual.",
    desde: a => a.aportacion_dias },
  { campo: "interes_anual", etiqueta: "Interés del efectivo parado", sufijo: "%",
    min: 0, max: 20, paso: 0.1,
    ayuda: "Lo que renta al año el dinero sin invertir, como una cuenta remunerada. Se abona de forma continua.",
    desde: a => +(a.interes_anual * 100).toFixed(2) },
];

// Los dos primeros son caídas: se piden en positivo y se guardan en negativo,
// así no hay que escribir signos menos en ningún campo.
const CAMPOS_AVANZADOS = [
  { campo: "stop_perdida", etiqueta: "Stop de pérdida", sufijo: "%", magnitud: true,
    min: 5, max: 80, paso: 1,
    ayuda: "Si una apuesta cae este porcentaje desde tu precio de entrada, se vende. Más ajustado te saca en cualquier bajón normal.",
    desde: a => Math.abs(a.stop_perdida) },
  { campo: "caida_desde_maximo", etiqueta: "Salida por desplome", sufijo: "%", magnitud: true,
    min: 10, max: 90, paso: 1,
    ayuda: "Si algo subió y luego cae esto desde su máximo, se sale aunque siga en ganancias.",
    desde: a => Math.abs(a.caida_desde_maximo) },
  { campo: "objetivo_parcial", etiqueta: "Multiplicador de recogida", sufijo: "x",
    min: 1.2, max: 10, paso: 0.1,
    ayuda: "Al alcanzar este múltiplo se vende una parte. Con 2x recuperas lo puesto y el resto corre gratis.",
    desde: a => a.objetivo_parcial },
  { campo: "fraccion_parcial", etiqueta: "Cuánto se recoge ahí", sufijo: "%",
    min: 10, max: 100, paso: 5,
    ayuda: "Qué porcentaje de la posición se vende al alcanzar el múltiplo.",
    desde: a => a.fraccion_parcial * 100 },
  { campo: "cuarentena_dias", etiqueta: "Cuarentena tras cerrar", sufijo: "d",
    min: 0, max: 90, paso: 1,
    ayuda: "Días que un activo queda vetado tras venderse. Evita recomprar lo que acaba de saltar por stop. En 0 está desactivada.",
    desde: a => a.cuarentena_dias },
  { campo: "max_posiciones", etiqueta: "Apuestas simultáneas", sufijo: "",
    min: 1, max: 20, paso: 1,
    ayuda: "Cuántas posiciones puede tener abiertas el cubo lotería a la vez.",
    desde: a => a.max_posiciones },
  { campo: "max_por_posicion", etiqueta: "Tamaño máximo por apuesta", sufijo: "%",
    min: 5, max: 100, paso: 5,
    ayuda: "Cuánto del cubo lotería puede ir a una sola apuesta. Bajo aguanta más fallos seguidos.",
    desde: a => a.max_por_posicion * 100 },
];

function fila(def, ajustes) {
  const rango = `Entre ${def.min} y ${def.max}${def.sufijo}.`;
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
    if (!r.ok) throw new Error("El servidor respondió " + r.status);
    ({ ajustes } = await r.json());
    if (!ajustes) throw new Error("El servidor no devolvió ajustes");
  } catch (e) {
    alert("No se pudieron cargar los ajustes.\n\n" + e.message +
          "\n\nSi pone 404, el server.py es de una versión anterior: " +
          "para el bot con parar.bat y vuelve a arrancarlo.");
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
    <div class="modal" role="dialog" aria-label="Ajustes de ${NOMBRES[wallet]}">
      <div class="modal-cabecera">
        <h3>Ajustes · ${NOMBRES[wallet]}</h3>
        <button class="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-cuerpo">
        <p class="modal-nota">Los valores por defecto son un punto de partida razonable,
        no los mejores: nadie los conoce. Cámbialos solo cuando tus datos te den un motivo.</p>

        ${CAMPOS_BASICOS.map(d => fila(d, ajustes)).join("")}

        <details class="avanzado">
          <summary>Dinero nuevo y efectivo</summary>
          ${CAMPOS_APORTACION.map(d => fila(d, ajustes)).join("")}
        </details>

        <details class="avanzado">
          <summary>Ajustes avanzados del cubo lotería</summary>
          <p class="modal-nota">Estas son las reglas de salida. Aquí es donde se gana o
          se pierde de verdad: entrar es fácil, salir a tiempo es el problema.</p>
          ${CAMPOS_AVANZADOS.map(d => fila(d, ajustes)).join("")}
        </details>

        <div class="modal-aviso" id="aviso-reparto" style="display:none"></div>
      </div>
      <div class="modal-pie">
        <button class="por-defecto">Volver a los valores por defecto</button>
        <div class="modal-acciones">
          <button class="cancelar">Cancelar</button>
          <button class="guardar destacado">Guardar</button>
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
        mensajes.push(`Con ${nuevo} % de ${eur(total)}, cada apuesta sería de ` +
          `${eur(apuesta)}, por debajo de la orden mínima de ${eur(minima)} en esta ` +
          `wallet. El cubo se quedaría en efectivo sin comprar nada.`);
      }
    }
    if (!isNaN(nuevo) && nuevo > original) {
      mensajes.push("Subir el reparto NO mete dinero en el cubo lotería. " +
        "Para eso está el botón «Reponer…».");
    } else if (!isNaN(nuevo) && nuevo < original) {
      mensajes.push("Bajar el reparto hará que el bot venda parte del cubo " +
        "lotería en el próximo ciclo.");
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
    if (!confirm("¿Devolver todos los ajustes de esta wallet a sus valores por defecto?")) return;
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
    botonGuardar.title = malos ? "Hay valores fuera de rango" : "";
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
      aviso.textContent = `Con ${n} apuestas de como mucho ${t} % cada una, ` +
        `el cubo lotería solo llegaría a invertir el ${cobertura.toFixed(0)} % de su dinero. ` +
        `El resto se quedaría siempre en efectivo.`;
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
    <input class="id-fuente" type="text" placeholder="id de CoinGecko o ticker de Yahoo" value="${a.id || ""}">
    <input class="nombre" type="text" placeholder="Nombre" value="${a.nombre || ""}">
    <input class="peso" type="number" min="0.1" max="10" step="0.1" value="${a.peso ?? 1}">
    <button class="activos-quitar" type="button" title="Quitar" aria-label="Quitar activo">✕</button>
  </div>`;
}

async function abrirActivos(wallet) {
  let activos;
  try {
    const r = await fetch(`/api/activos/${wallet}`);
    if (!r.ok) throw new Error("El servidor respondió " + r.status);
    ({ activos } = await r.json());
    if (!activos) throw new Error("El servidor no devolvió activos");
  } catch (e) {
    alert("No se pudieron cargar los activos.\n\n" + e.message +
          "\n\nSi pone 404, el server.py es de una versión anterior: " +
          "para el bot con parar.bat y vuelve a arrancarlo.");
    return;
  }

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.style.cssText =
    "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;" +
    "justify-content:center;padding:24px;background:rgba(5,6,14,.72)";
  fondo.innerHTML = `
    <div class="modal" role="dialog" aria-label="Activos de ${NOMBRES[wallet]}">
      <div class="modal-cabecera">
        <h3>Activos vigilados · ${NOMBRES[wallet]}</h3>
        <button class="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-cuerpo">
        <p class="modal-nota">Son los activos del cubo seguro: el bot reparte el dinero entre
        ellos según su peso y vigila que no se desvíen. El identificador es el id de CoinGecko
        para cripto (p. ej. «cardano») o el ticker de Yahoo Finance para bróker (p. ej. «AAPL»).
        No se puede quitar uno con una posición abierta.</p>
        <div class="activos-lista">
          ${activos.map(a => filaActivo(a)).join("")}
        </div>
        <button type="button" class="activos-anadir">+ Añadir activo</button>
        <div class="modal-aviso" id="aviso-activos" style="display:none"></div>
      </div>
      <div class="modal-pie">
        <button class="por-defecto">Volver a los valores por defecto</button>
        <div class="modal-acciones">
          <button class="cancelar">Cancelar</button>
          <button class="guardar destacado">Guardar</button>
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
    if (!confirm(`¿Devolver ${NOMBRES[wallet]} a sus activos por defecto?`)) return;
    const res = await (await fetch(`/api/activos/${wallet}/defecto`, { method: "POST" })).json();
    if (res.error) { mostrarError(res.error); return; }
    cerrar(); refrescar();
  };

  modal.querySelector(".guardar").onclick = async ev => {
    const filas = [...lista.querySelectorAll(".activos-fila")];
    if (!filas.length) { mostrarError("Tiene que quedar al menos un activo."); return; }

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