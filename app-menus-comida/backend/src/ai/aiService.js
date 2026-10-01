// aiService: the ONLY entry point to the AI.
//
// The rest of the app calls `generateText()` or `generateJson()` and never
// knows which provider is behind them. The provider and the model are chosen
// with AI_PROVIDER and AI_MODEL in backend/.env (AI_FALLBACK_MODEL is used
// when the main model is overloaded).
import { config } from '../config.js';
import { AiError } from './aiErrors.js';
import { createGeminiProvider } from './providers/gemini.js';

// Registered providers: name → factory(model) that returns { generate }, or
// null if it is not configured. New providers (claude, groq, ollama) go here.
const PROVIDERS = {
  gemini: (model) => (config.ai.geminiApiKey ? createGeminiProvider({ apiKey: config.ai.geminiApiKey, model }) : null),
};

const providers = new Map(); // model → provider instance, created on first use

function getProvider(model = config.ai.model) {
  if (!providers.has(model)) {
    const factory = PROVIDERS[config.ai.provider];
    if (!factory) console.warn(`[ai] Unknown AI_PROVIDER "${config.ai.provider}".`);
    providers.set(model, factory ? factory(model) : null);
  }
  const provider = providers.get(model);
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

const UNAVAILABLE_RETRY_DELAY_MS = 2500;

/**
 * Calls the provider. "Unavailable" errors (overloaded model, network blip) are
 * usually gone in seconds, so they get one retry after a short pause, using the
 * fallback model if there is one (a lighter model is rarely overloaded too).
 * Rate-limit errors are NOT retried: retrying would only waste free quota.
 */
async function callProvider(request) {
  try {
    return await getProvider().generate(request);
  } catch (error) {
    if (!(error instanceof AiError) || error.code !== 'unavailable') throw error;
    const retryModel = config.ai.fallbackModel || config.ai.model;
    console.warn(`[ai] Provider unavailable, retrying once with ${retryModel}…`);
    await new Promise((resolve) => setTimeout(resolve, UNAVAILABLE_RETRY_DELAY_MS));
    return getProvider(retryModel).generate(request);
  }
}

/** Plain text answer (e.g. a chat reply). */
export async function generateText({ system, messages, files }) {
  return logErrors(() => callProvider({ system, messages, files }));
}

/**
 * JSON answer validated with a zod schema.
 * If the answer is not valid, asks ONCE more explaining what was wrong;
 * if it still fails, throws AiError('invalid_response').
 */
export async function generateJson({ system, messages, schema, files }) {
  return logErrors(async () => {
    const first = await callProvider({ system, messages, files, json: true });
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
    const second = await callProvider({ system, messages: retryMessages, files, json: true });
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
