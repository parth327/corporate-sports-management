import { config } from './config';
import { tokenStore } from './tokenStore';

/**
 * The auth scheme is not decided yet, so it lives behind one interface with both
 * implementations written. Flip VITE_AUTH_STRATEGY to switch; nothing else in
 * the app reads the scheme directly.
 */
export interface AuthStrategy {
  readonly name: 'bearer' | 'cookie';

  /** Extra headers to merge into every outgoing request. */
  headers(): Record<string, string>;

  /** Whether fetch should attach cookies. */
  credentials(): RequestCredentials;

  /** Shape of the login request body + content type. */
  loginRequest(userName: string, password: string): { body: BodyInit; contentType: string };

  /** URL the login POST goes to. */
  loginPath(): string;

  /** Pull the token + lifetime out of whatever the server returned. */
  readLoginResponse(payload: Record<string, unknown>): { token: string; expiresIn: number };
}

/**
 * ASP.NET Web API 4.5 + OWIN. `/token` takes a form-encoded OAuth password
 * grant and returns `access_token`. This is the default for a Web API 4.5
 * project scaffolded with Individual User Accounts.
 */
const bearerStrategy: AuthStrategy = {
  name: 'bearer',

  headers() {
    const token = tokenStore.token;
    const result: Record<string, string> = {};
    if (token) result.Authorization = `Bearer ${token}`;
    return result;
  },

  credentials() {
    return 'same-origin';
  },

  loginPath() {
    return '/token';
  },

  loginRequest(userName, password) {
    const body = new URLSearchParams({
      grant_type: 'password',
      username: userName,
      password,
    });
    return { body: body.toString(), contentType: 'application/x-www-form-urlencoded' };
  },

  readLoginResponse(payload) {
    const token = String(payload.access_token ?? payload.accessToken ?? '');
    const expiresIn = Number(payload.expires_in ?? payload.expiresIn ?? 3600);
    return { token, expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600 };
  },
};

/**
 * Forms / cookie auth. The server sets an HttpOnly cookie, so there is no token
 * to store or send — but every request must opt into credentials, and the API
 * must reply with `Access-Control-Allow-Credentials: true` plus an explicit
 * origin (a wildcard origin is rejected by browsers when credentials are on).
 */
const cookieStrategy: AuthStrategy = {
  name: 'cookie',

  headers() {
    return {};
  },

  credentials() {
    return 'include';
  },

  loginPath() {
    return '/api/account/login';
  },

  loginRequest(userName, password) {
    return {
      body: JSON.stringify({ userName, password }),
      contentType: 'application/json',
    };
  },

  readLoginResponse() {
    /* The cookie is the session. We still record a nominal lifetime so the UI
       knows when to prompt for re-authentication. */
    return { token: 'cookie', expiresIn: 60 * 60 * 8 };
  },
};

export const authStrategy: AuthStrategy =
  config.authStrategy === 'cookie' ? cookieStrategy : bearerStrategy;
