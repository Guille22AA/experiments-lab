// Error with an HTTP status and a user-facing message (in Spanish, shown in the UI).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
