// AI errors with a friendly Spanish message for the UI.
// Providers translate their own errors into one of these codes, so the rest of
// the app never has to know which provider failed or how.

const ERRORS = {
  not_configured: {
    status: 503,
    message: 'El asistente no está configurado: falta la clave de la IA en backend/.env.',
  },
  auth: {
    status: 503,
    message: 'La clave de la IA no es válida. Revísala en backend/.env.',
  },
  bad_model: {
    status: 503,
    message: 'El modelo de IA configurado no existe. Revisa AI_MODEL en backend/.env.',
  },
  rate_limit: {
    status: 429,
    message:
      'La IA ha llegado a su límite de peticiones gratuitas. Espera un rato y vuelve a intentarlo; el resto de la app funciona igual.',
  },
  unavailable: {
    status: 503,
    message:
      'La IA no responde ahora mismo. Inténtalo en un rato; mientras, la despensa, la lista y las recetas funcionan igual.',
  },
  invalid_response: {
    status: 502,
    message: 'La IA ha devuelto una respuesta que no se entiende. Prueba otra vez.',
  },
};

export class AiError extends Error {
  /**
   * @param {keyof ERRORS} code
   * @param {unknown} [cause] original error, only for the server logs
   */
  constructor(code, cause) {
    const info = ERRORS[code] ?? ERRORS.unavailable;
    super(info.message, { cause });
    this.code = code;
    this.status = info.status;
  }
}
