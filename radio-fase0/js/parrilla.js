import { weekSchedule, currentBlock, nextBlock, nowInTz, DAY_LABELS } from "./radio.js";

// Parrilla semanal: 7 columnas, filas de media hora. Cada franja ocupa su alto real.
const ROW_MIN = 30;

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
};

export function startParrilla(root, onNowChange) {
  const grid = root.querySelector(".parrilla-grid");
  const scroller = root.querySelector(".parrilla-scroll");
  const week = weekSchedule();
  const cells = new Map();

  // Eje de horas
  for (let h = 0; h < 24; h += 2) {
    grid.append(el("span", {
      className: "p-hour",
      textContent: `${String(h).padStart(2, "0")}:00`,
      style: `grid-column: 1; grid-row: ${(h * 60) / ROW_MIN + 2}`,
    }));
  }

  week.forEach((slots, day) => {
    grid.append(el("h3", { className: "p-day", textContent: DAY_LABELS[day], style: `grid-column: ${day + 2}; grid-row: 1` }));
    for (const b of slots) {
      const minutes = b.toMin - b.fromMin;
      const cell = el("div",
        {
          className: `p-slot m-${b.mood || "neutral"}${minutes <= 90 ? " is-short" : ""}`,
          title: `${b.name}, de ${b.from} a ${b.to}`,
          style: `grid-column: ${day + 2}; grid-row: ${b.fromMin / ROW_MIN + 2} / ${b.toMin / ROW_MIN + 2}`,
        },
        el("span", { className: "p-name", textContent: b.name }),
        el("span", { className: "p-time", textContent: `${b.from}–${b.to}` }),
        minutes >= 180 && b.genres ? el("span", { className: "p-mood", textContent: b.genres }) : null,
      );
      cells.set(b.key, cell);
      grid.append(cell);
    }
  });

  let lastKey = null;
  let firstRun = true;
  const refresh = () => {
    const now = currentBlock();
    const today = nowInTz().day;
    grid.querySelectorAll(".p-day").forEach((d, i) => d.classList.toggle("is-today", i === today));
    if (now.key === lastKey) return;
    cells.get(lastKey)?.classList.remove("is-now");
    cells.get(now.key)?.classList.add("is-now");
    cells.get(now.key)?.setAttribute("aria-current", "true");
    if (lastKey) cells.get(lastKey)?.removeAttribute("aria-current");
    lastKey = now.key;
    onNowChange?.(now, nextBlock());

    // En pantallas estrechas, que se vea el día de hoy sin tener que buscarlo.
    if (firstRun) {
      firstRun = false;
      const col = cells.get(now.key);
      if (col && scroller.scrollWidth > scroller.clientWidth) {
        scroller.scrollLeft = col.offsetLeft - scroller.clientWidth / 2 + col.offsetWidth / 2;
      }
    }
  };
  refresh();
  setInterval(refresh, 30000);
}
