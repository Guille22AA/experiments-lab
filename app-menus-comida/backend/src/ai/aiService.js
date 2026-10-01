// aiService: the ONLY entry point to the AI.
//
// The rest of the app calls `generateText()` or `generateJson()` and never
// knows which provider is behind them. The provider and the model are chosen
// with AI_PROVIDER and AI_MODEL in backend/.env.
import { config } from '../config.js';
import { AiError } from './aiErrors.js';
import { createGeminiProvider } from './providers/gemini.js';

// Registered providers: name → factory that returns { generate } or null if
// it is not configured. New providers (claude, groq, ollama) go here.
const PROVIDERS = {
  gemini: () =>
    config.ai.geminiApiKey ? createGeminiProvider({ apiKey: config.ai.geminiApiKey, model: config.ai.model }) : null,
};

let provider; // created on first use

function getProvider() {
  if (provider === undefined) {
    const factory = PROVIDERS[config.ai.provider];
    if (!factory) console.warn(`[ai] Unknown AI_PROVIDER "${config.ai.provider}".`);
    provider = factory ? factory() : null;
  }
  if (!provider) throw new AiError('not_configured');
  return provider;
}

/** True when the AI can be used (key present and provider known). */
export function isAiConfigured() {
  try {
    getProvider();
    return true;
  } catch {
    return false;
  }
}

/** Plain text answer (e.g. a chat reply). */
export async function generateText({ system, messages, files }) {
  return logErrors(() => getProvider().generate({ system, messages, files }));
}

/**
 * JSON answer validated with a zod schema.
 * If the answer is not valid, asks ONCE more explaining what was wrong;
 * if it still fails, throws AiError('invalid_response').
 */
export async function generateJson({ system, messages, schema, files }) {
  return logErrors(async () => {
    const first = await getProvider().generate({ system, messages, files, json: true });
    const firstResult = parseAndValidate(first, schema);
    if (firstResult.ok) return firstResult.data;

    console.warn('[ai] Invalid JSON, retrying once:', firstResult.problem);
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: `Your previous answer was not valid for the required JSON format (${firstResult.problem}). Answer again with ONLY the corrected JSON.`,
      },
    ];
    const second = await getProvider().generate({ system, messages: retryMessages, files, json: true });
    const secondResult = parseAndValidate(second, schema);
    if (secondResult.ok) return secondResult.data;

    throw new AiError('invalid_response', new Error(secondResult.problem));
  });
}

function parseAndValidate(text, schema) {
  let value;
  try {
    // Some models wrap JSON in ```json fences even when asked not to.
    value = JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    return { ok: false, problem: 'the text is not JSON' };
  }
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const problem = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return { ok: false, problem };
}

/** Logs the technical cause on the server; the UI only gets the friendly message. */
async function logErrors(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AiError) console.error(`[ai] ${error.code}:`, error.cause?.message ?? '');
    throw error;
  }
}
