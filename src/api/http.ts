import { authStrategy } from './authStrategy';
import { config } from './config';
import { ApiError, normaliseApiError } from './errors';
import { toQueryString, type RequestSpec, type Transport } from './transport';

/**
 * The real transport: fetch against the ASP.NET Web API.
 *
 * Responsibilities, in order:
 *   1. build the URL
 *   2. attach auth (delegated to the strategy)
 *   3. send
 *   4. normalise the three Web API error shapes into one ApiError
 *   5. broadcast 401 so the auth context can sign the user out
 */

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};

/** Wired up once by AuthProvider. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/** PascalCase -> camelCase, applied recursively. Off by default. */
function camelise(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(camelise);
  if (input && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key.charAt(0).toLowerCase() + key.slice(1)] = camelise(value);
    }
    return out;
  }
  return input;
}

export const httpTransport: Transport = async <T,>(spec: RequestSpec): Promise<T> => {
  const url = `${config.apiBaseUrl}${spec.path}${toQueryString(spec.query)}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!spec.anonymous) Object.assign(headers, authStrategy.headers());

  let body: BodyInit | undefined;
  if (spec.rawBody !== undefined) {
    body = spec.rawBody;
    if (spec.contentType) headers['Content-Type'] = spec.contentType;
  } else if (spec.body !== undefined) {
    body = JSON.stringify(spec.body);
    headers['Content-Type'] = spec.contentType ?? 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: spec.method,
      headers,
      body,
      credentials: authStrategy.credentials(),
      signal: spec.signal,
    });
  } catch (cause) {
    /* An aborted request is a caller decision, not a failure to report. */
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(
      'Could not reach the server. Check that the API is running and that CORS allows this origin.',
      0,
      {},
      cause,
    );
  }

  if (response.status === 401 && !spec.anonymous) onUnauthorized();

  if (!response.ok) {
    let payload: unknown = null;
    try {
      const text = await response.text();
      payload = text ? JSON.parse(text) : null;
    } catch {
      /* Non-JSON error body (an IIS HTML error page, typically). */
    }
    throw normaliseApiError(response.status, payload);
  }

  if (spec.expectBlob) return (await response.blob()) as T;

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    /* Typically an SPA fallback serving index.html with a 200 for an API path. */
    throw new ApiError(
      'The server answered with something other than JSON. Check that VITE_API_BASE_URL points at the API, not the website.',
      response.status,
      {},
      cause,
    );
  }
  return (config.normaliseCasing ? camelise(parsed) : parsed) as T;
};
