// Receipt reading: the AI extracts the lines, then code matches them with known
// products. Nothing is saved here: the user ALWAYS reviews the result first.
import { generateJson } from '../ai/aiService.js';
import { buildTicketPrompt } from '../ai/prompts/ticketPrompt.js';
import { ticketSchema } from '../ai/schemas/ticketSchema.js';
import { findProductByName } from '../db/repositories/productRepo.js';
import { findSectionByName, listSections } from '../db/repositories/sectionRepo.js';
import { HttpError } from '../lib/errors.js';
import { capitalize } from '../lib/text.js';
import { guessProductInfo } from './products.js';

export const TICKET_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * @param {{ mimeType: string, base64: string }} file
 * @returns lines ready for the review screen
 */
export async function readTicket(file) {
  const sections = listSections();
  const ticket = await generateJson({
    system: buildTicketPrompt(sections.map((s) => s.name)),
    messages: [{ role: 'user', content: 'Extrae los productos de este ticket.' }],
    files: [file],
    schema: ticketSchema,
  });

  if (ticket.items.length === 1 && ticket.items[0].rawText === 'ILEGIBLE') {
    throw new HttpError(422, 'No he podido leer el ticket. Prueba con una foto más nítida o con el PDF.');
  }

  const lines = ticket.items.map((item) => {
    // Known product? First by the printed text (alias learned last time), then by the generic name.
    const known = findProductByName(item.rawText) ?? findProductByName(item.name);
    if (known) {
      return {
        productId: known.id,
        name: known.name,
        sectionId: known.sectionId,
        isNew: false,
        hasTagData: true,
        rawText: item.rawText,
        quantityText: item.quantity,
        price: item.price,
        tags: known.tags,
      };
    }
    const guess = guessProductInfo(item.name, item.tags);
    return {
      productId: null,
      name: capitalize(item.name),
      sectionId: (item.section && findSectionByName(item.section)?.id) || guess.sectionId,
      isNew: true,
      hasTagData: guess.hasTagData,
      rawText: item.rawText,
      quantityText: item.quantity,
      price: item.price,
      tags: guess.tags,
    };
  });

  return { date: ticket.date, total: ticket.total, lines };
}
