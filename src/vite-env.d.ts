/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the ASP.NET Web API, e.g. https://localhost:44301 */
  readonly VITE_API_BASE_URL?: string;
  /** 'true' keeps the in-memory mock transport; 'false' hits the real API. */
  readonly VITE_USE_MOCK_API?: string;
  /** 'bearer' (OWIN /token) or 'cookie' (Forms auth). */
  readonly VITE_AUTH_STRATEGY?: string;
  /** Artificial latency in ms applied to mock responses. */
  readonly VITE_MOCK_LATENCY?: string;
  /** 'true' if the Web API returns PascalCase JSON and needs re-casing. */
  readonly VITE_NORMALISE_CASING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/* The public marketing site is still authored in JSX. These shims let the
   TypeScript console import it without converting the whole landing page. */
declare module '*.jsx';
