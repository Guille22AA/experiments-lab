// Shopping list export: plain text to share, copy, download as .txt or print.
// Only what is still to buy (not ticked) is exported.

/** Groups pending items by section in walking order; items without section go to "Otros". */
export function groupPending(items, sections) {
  const pending = items.filter((item) => !item.checked);
  const groups = sections.map((section) => ({ name: section.name, items: pending.filter((i) => i.sectionId === section.id) }));
  groups.push({ name: 'Otros', items: pending.filter((i) => !i.sectionId) });
  return groups.filter((group) => group.items.length > 0);
}

export function buildListText(items, sections) {
  const date = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const lines = [`Lista de la compra (${date})`];
  for (const group of groupPending(items, sections)) {
    lines.push('', group.name.toUpperCase());
    for (const item of group.items) lines.push(`- ${item.text}${item.quantityText ? ` (${item.quantityText})` : ''}`);
  }
  return lines.join('\n');
}

export function downloadText(text, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Copies text to the clipboard. The modern Clipboard API only works on https or
 * localhost; on the phone through the local network (http://192.168…) we fall
 * back to the old method, which still works there.
 */
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('No se ha podido copiar.');
}

/** Web Share API (WhatsApp, notes...). Only available in some browsers and on https. */
export const canShare = () => typeof navigator.share === 'function';

export async function shareText(text) {
  try {
    await navigator.share({ title: 'Lista de la compra', text });
  } catch (err) {
    if (err.name !== 'AbortError') throw err; // closing the share menu is not an error
  }
}
