/**
 * The contract both transports implement. `src/api/index.ts` picks one at
 * startup; every hook and page above this line is identical either way.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestSpec {
  method: HttpMethod;
  path: string;
  query?: Record<string, unknown> | undefined;
  /** Serialised as JSON unless `rawBody` is supplied. */
  body?: unknown;
  /** Pre-encoded body (used by the OAuth form post). */
  rawBody?: BodyInit;
  contentType?: string;
  /** Skip the Authorization header — used for login and public registration. */
  anonymous?: boolean;
  /** Resolve with a Blob instead of parsed JSON (file downloads). */
  expectBlob?: boolean;
  signal?: AbortSignal;
}

export type Transport = <T>(spec: RequestSpec) => Promise<T>;

/** `{ a: 1, b: null, c: [1,2] }` -> `?a=1&c=1&c=2` (nulls dropped). */
export function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
