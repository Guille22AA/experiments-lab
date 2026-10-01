// Downloads a web page for the recipe importer, safely:
// - only http/https,
// - never addresses inside the local network (router, this PC...): otherwise a
//   pasted link could make the server read private things ("SSRF"),
// - time and size limits.
import dns from 'node:dns/promises';
import net from 'node:net';
import { HttpError } from './errors.js';

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** True for loopback, private, link-local and similar addresses. */
function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const lower = address.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7)); // IPv4 written as IPv6
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

async function assertPublicUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HttpError(400, 'Solo puedo abrir enlaces http o https.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new HttpError(400, 'No encuentro esa página. ¿Está bien escrito el enlace?');
  }
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new HttpError(400, 'Ese enlace apunta a tu red local y no lo puedo abrir.');
  }
}

/** Reads the body without going over MAX_BYTES. */
async function readLimited(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break; // a recipe is near the top; a cut page is still useful
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** @returns {Promise<{ html: string, finalUrl: string }>} */
export async function fetchPage(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, 'Eso no parece un enlace.');
  }

  // Redirects are followed by hand, so every hop is checked too.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (recipe importer)', Accept: 'text/html' },
      });
    } catch {
      throw new HttpError(502, 'La página no responde. Prueba más tarde o pega el texto de la receta.');
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location'), url);
      continue;
    }
    if (!response.ok) throw new HttpError(502, `La página ha respondido con un error (${response.status}). Pega el texto de la receta.`);
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
      throw new HttpError(400, 'Ese enlace no es una página web con texto.');
    }
    return { html: await readLimited(response), finalUrl: url.toString() };
  }
  throw new HttpError(502, 'La página redirige demasiadas veces.');
}
