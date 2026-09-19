import { CONFIG } from "./config.js";
import { todayInTz } from "./radio.js";

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
};

const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);

const hour = (iso) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: CONFIG.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const EDITIONS = { "mañana": "Edición de la mañana", "mediodía": "Edición del mediodía", tarde: "Edición de la tarde" };

// ── Boletín ─────────────────────────────────────────────────

export function startNews(root) {
  const load = async () => {
    try {
      const r = await fetch(`data/news.json?t=${Date.now()}`);
      if (!r.ok) throw new Error();
      renderNews(root, await r.json());
    } catch {
      root.querySelector(".edition").textContent = "No se ha podido cargar el boletín.";
    }
  };
  load();
  setInterval(load, 15 * 60 * 1000);
}

function newsLink(item) {
  const url = safeUrl(item.link);
  return url ? el("a", { href: url, target: "_blank", rel: "noopener", textContent: item.title }) : el("span", { textContent: item.title });
}

function renderNews(root, news) {
  const edition = root.querySelector(".edition");
  const body = root.querySelector(".boletin-body");
  body.replaceChildren();

  if (!news.updatedAt) {
    edition.textContent = "Aún no hay boletín. Se genera solo tres veces al día.";
    return;
  }
  const stale = news.date !== todayInTz();
  edition.textContent = `${EDITIONS[news.edition] || "Boletín"}, actualizado a las ${hour(news.updatedAt)}${stale ? " de ayer" : ""}`;

  let n = 0;
  for (const section of news.sections || []) {
    if (!section.highlights?.length && !section.items?.length) continue;
    const box = el("section", { className: "news-section" }, el("h3", { className: "section-title", textContent: section.title }));

    for (const h of section.highlights || []) {
      const sources = h.sources || [h.source];
      const summaryId = `resumen-${n++}`;
      const summary = h.summary ? el("p", { className: "summary", id: summaryId, textContent: h.summary }) : null;
      const toggle = h.summary ? el("button", { className: "read-more", type: "button", textContent: "Leer más", hidden: true }) : null;
      const article = el("article", { className: "highlight" },
        el("h4", {}, newsLink(h)),
        summary,
        el("div", { className: "highlight-foot" },
          el("p", { className: "meta", textContent: sources.length > 1 ? `En ${sources.length} medios: ${sources.join(", ")}` : sources[0] }),
          toggle,
        ),
      );
      if (toggle) {
        toggle.setAttribute("aria-controls", summaryId);
        toggle.setAttribute("aria-expanded", "false");
        toggle.addEventListener("click", () => {
          const open = article.classList.toggle("is-open");
          toggle.textContent = open ? "Leer menos" : "Leer más";
          toggle.setAttribute("aria-expanded", String(open));
        });
      }
      box.append(article);
    }

    if (section.items?.length) {
      const latest = el("ul", { className: "latest" });
      for (const item of section.items) {
        latest.append(el("li", {}, newsLink(item), el("span", { className: "meta", textContent: ` ${item.source}` })));
      }
      box.append(el("h4", { className: "latest-title", textContent: "Última hora" }), latest);
    }
    body.append(box);
  }

  // "Leer más" solo donde el resumen está cortado de verdad.
  requestAnimationFrame(() => {
    body.querySelectorAll(".highlight").forEach((a) => {
      const p = a.querySelector(".summary");
      const b = a.querySelector(".read-more");
      if (p && b) b.hidden = p.scrollHeight <= p.clientHeight + 1;
    });
  });
}

// ── Cartel ──────────────────────────────────────────────────

export async function startCarteles(root) {
  let list = [];
  try {
    const r = await fetch(`data/carteles.json?t=${Date.now()}`);
    const today = todayInTz();
    list = (await r.json()).filter((c) => c.imagen && (!c.desde || c.desde <= today) && (!c.hasta || c.hasta >= today));
  } catch { /* sin carteles */ }

  if (!list.length) { root.classList.add("is-empty"); return; }

  const img = root.querySelector("img");
  const link = root.querySelector(".cartel-link");
  let i = 0;
  const show = (c) => {
    img.src = c.imagen;
    img.alt = c.texto || "Cartel";
    link.href = safeUrl(c.imagen) || c.imagen; // al pulsar se abre el cartel a tamaño completo en otra pestaña
    link.title = "Ver el cartel completo";
  };
  show(list[0]);
  if (list.length > 1) setInterval(() => show(list[++i % list.length]), 20000);
}

// ── Tablón de convocatorias ─────────────────────────────────
// data/carteles-auto.json lo genera scripts/fetch-carteles.mjs una vez al día.

export async function startTablon(root) {
  let list = [];
  try {
    const r = await fetch(`data/carteles-auto.json?t=${Date.now()}`);
    const today = todayInTz();
    list = (await r.json()).filter((c) => safeUrl(c.imagen) && c.hasta >= today).sort((a, b) => a.fecha.localeCompare(b.fecha));
  } catch { /* sin convocatorias */ }
  if (!list.length) return;

  const day = (iso) => new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`));
  const grid = root.querySelector(".tablon-grid");
  grid.replaceChildren(...list.map((c) => {
    const img = el("img", { src: c.imagen, alt: c.texto, loading: "lazy", referrerPolicy: "no-referrer" });
    const card = el("figure", { className: "poster" },
      safeUrl(c.enlace) ? el("a", { href: c.enlace, target: "_blank", rel: "noopener" }, img) : img,
      el("figcaption", {}, el("strong", { textContent: day(c.fecha) }), ` · ${c.fuente}`, el("br"), el("span", { textContent: c.texto })),
    );
    return card;
  }));
  root.hidden = false;
}
