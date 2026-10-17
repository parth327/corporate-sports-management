/**
 * One error shape for the whole app, whichever transport produced it.
 *
 * ASP.NET Web API 4.5 has three different ways of reporting a failure and the
 * UI should not have to know which one it got:
 *
 *   ModelState   { Message, ModelState: { "model.Name": ["required"] } }
 *   HttpError    { Message, ExceptionMessage, StackTrace }
 *   OAuth /token { error: "invalid_grant", error_description: "..." }
 */
export class ApiError extends Error {
  readonly status: number;
  /** Field-level messages keyed by form field name, ready for setError(). */
  readonly fieldErrors: Record<string, string>;
  readonly raw: unknown;

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    raw: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.raw = raw;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isValidation(): boolean {
    return this.status === 400 || Object.keys(this.fieldErrors).length > 0;
  }
}

/** Turns any of the three Web API failure bodies into an ApiError. */
export function normaliseApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;

    // OAuth token endpoint
    if (typeof b.error === 'string') {
      const desc = typeof b.error_description === 'string' ? b.error_description : b.error;
      return new ApiError(desc, status, {}, body);
    }

    // ModelState validation
    const modelState = (b.ModelState ?? b.modelState) as Record<string, string[]> | undefined;
    if (modelState && typeof modelState === 'object') {
      const fieldErrors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(modelState)) {
        // "model.Name" / "$.name" -> "name"
        const field = key.split('.').pop() ?? key;
        const first = Array.isArray(messages) ? messages[0] : String(messages);
        if (first) fieldErrors[field.charAt(0).toLowerCase() + field.slice(1)] = first;
      }
      const message =
        (typeof b.Message === 'string' && b.Message) ||
        Object.values(fieldErrors)[0] ||
        'Validation failed.';
      return new ApiError(message, status, fieldErrors, body);
    }

    // HttpError
    const message =
      (typeof b.Message === 'string' && b.Message) ||
      (typeof b.message === 'string' && b.message) ||
      (typeof b.ExceptionMessage === 'string' && b.ExceptionMessage) ||
      null;
    if (message) return new ApiError(message, status, {}, body);
  }

  if (typeof body === 'string' && body.trim()) {
    return new ApiError(body, status, {}, body);
  }

  return new ApiError(defaultMessage(status), status, {}, body);
}

function defaultMessage(status: number): string {
  switch (status) {
    case 0:
      return 'Could not reach the server. Check that the API is running and CORS allows this origin.';
    case 400:
      return 'The request was rejected. Please review the highlighted fields.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'That record no longer exists.';
    case 409:
      return 'That change conflicts with an existing record.';
    case 500:
      return 'The server encountered an error. Please try again.';
    default:
      return `Request failed (HTTP ${status}).`;
  }
}
