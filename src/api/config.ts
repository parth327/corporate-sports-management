/**
 * Runtime configuration. Everything here is driven by `.env` files so the same
 * build artefact can point at localhost, staging or production.
 *
 * See `.env.example` for the full list.
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  /**
   * Base URL of the ASP.NET Web API. Leave empty to issue same-origin requests
   * (which is what you want when the Vite dev-server proxy is enabled, or when
   * the SPA is published into the Web API project's wwwroot).
   */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),

  /**
   * THE SWITCH. `true` serves everything from the seeded in-memory dataset in
   * `src/api/mock/`. Set VITE_USE_MOCK_API=false to hit the real API instead.
   * No other file needs to change.
   */
  useMockApi: bool(import.meta.env.VITE_USE_MOCK_API, true),

  /** 'bearer' = OWIN /token endpoint. 'cookie' = Forms auth. */
  authStrategy: (import.meta.env.VITE_AUTH_STRATEGY ?? 'bearer') as 'bearer' | 'cookie',

  /** Fake network latency for the mock transport, so loading states are real. */
  mockLatency: int(import.meta.env.VITE_MOCK_LATENCY, 320),

  /**
   * Set true if your Web API returns PascalCase JSON (i.e. you did NOT add
   * CamelCasePropertyNamesContractResolver in WebApiConfig.cs).
   */
  normaliseCasing: bool(import.meta.env.VITE_NORMALISE_CASING, false),

  storageKeys: {
    token: 'csem.auth.token',
    user: 'csem.auth.user',
    expiry: 'csem.auth.expiry',
  },
} as const;
