import { config } from './config';
import type { AuthUser } from './types';

/**
 * Where the session lives between page loads.
 *
 * `rememberMe` decides the backing store: localStorage survives a browser
 * restart, sessionStorage dies with the tab. Both are wrapped in try/catch
 * because private-mode Safari throws on write, and a storage failure must never
 * take the app down — it just means the user logs in again.
 */

type Stored = { token: string; user: AuthUser; expiresAt: number };

let memory: Stored | null = null;

function stores(): Storage[] {
  try {
    return [window.localStorage, window.sessionStorage];
  } catch {
    return [];
  }
}

export const tokenStore = {
  save(token: string, user: AuthUser, expiresInSeconds: number, remember: boolean): void {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    memory = { token, user, expiresAt };
    try {
      const store = remember ? window.localStorage : window.sessionStorage;
      store.setItem(config.storageKeys.token, token);
      store.setItem(config.storageKeys.user, JSON.stringify(user));
      store.setItem(config.storageKeys.expiry, String(expiresAt));
    } catch {
      /* Memory-only session. Fine — it just won't survive a reload. */
    }
  },

  read(): Stored | null {
    if (memory && memory.expiresAt > Date.now()) return memory;

    for (const store of stores()) {
      try {
        const token = store.getItem(config.storageKeys.token);
        const rawUser = store.getItem(config.storageKeys.user);
        const expiresAt = Number(store.getItem(config.storageKeys.expiry));

        if (token && rawUser && Number.isFinite(expiresAt)) {
          if (expiresAt <= Date.now()) {
            this.clear();
            return null;
          }
          memory = { token, user: JSON.parse(rawUser) as AuthUser, expiresAt };
          return memory;
        }
      } catch {
        /* Corrupt entry — fall through and treat as signed out. */
      }
    }
    return null;
  },

  get token(): string | null {
    return this.read()?.token ?? null;
  },

  get user(): AuthUser | null {
    return this.read()?.user ?? null;
  },

  clear(): void {
    memory = null;
    for (const store of stores()) {
      try {
        store.removeItem(config.storageKeys.token);
        store.removeItem(config.storageKeys.user);
        store.removeItem(config.storageKeys.expiry);
      } catch {
        /* Nothing to clean up. */
      }
    }
  },
};
