// Google Gemini provider.
//
// Every provider exposes the same function:
//   generate({ system, messages, json, files }) → Promise<string>
//     system   : instructions for the model (string)
//     messages : [{ role: 'user' | 'assistant', content: string }]
//     json     : true to ask for a JSON-only answer
//     files    : optional [{ mimeType, base64 }] attached to the last message (tickets)
// and throws AiError on failure. To add Claude, Groq or Ollama, create a file
// like this one and register it in aiService.js.
import { ApiError, GoogleGenAI } from '@google/genai';
import { AiError } from '../aiErrors.js';

const REQUEST_TIMEOUT_MS = 60_000;

export function createGeminiProvider({ apiKey, model }) {
  const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });

  async function generate({ system, messages, json = false, files = [] }) {
    // Gemini calls the assistant role "model".
    const contents = messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

    // Attach files (images / PDF) to the last user message.
    if (files.length > 0) {
      const last = contents.at(-1);
      for (const file of files) last.parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
    }

    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          responseMimeType: json ? 'application/json' : 'text/plain',
        },
      });
      const text = response.text;
      if (!text) throw new AiError('invalid_response');
      return text;
    } catch (error) {
      throw toAiError(error);
    }
  }

  return { generate };
}

/** Translates Gemini errors into our own error codes. */
function toAiError(error) {
  if (error instanceof AiError) return error;
  if (error instanceof ApiError) {
    if (error.status === 429) return new AiError('rate_limit', error);
    if (error.status === 404) return new AiError('bad_model', error);
    if (error.status === 401 || error.status === 403) return new AiError('auth', error);
    // An invalid key comes back as 400 with this text.
    if (error.status === 400 && /api key/i.test(error.message)) return new AiError('auth', error);
  }
  // Network problems, timeouts, 5xx...
  return new AiError('unavailable', error);
}
