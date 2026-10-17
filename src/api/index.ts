import { localIsoDate } from '@/lib/dates';
import { authStrategy } from './authStrategy';
import { config } from './config';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import { httpTransport } from './http';
import { tokenStore } from './tokenStore';
import type { RequestSpec, Transport } from './transport';
import type {
  AuthUser,
  ClassifyRequest,
  ClassifyResult,
  DashboardFilters,
  DashboardSummary,
  HistoryFilters,
  HistoryResult,
  ExportRequest,
  ListQuery,
  PagedResult,
  PlayerMaster,
  PlayerStatus,
} from './types';

/**
 * THE SEAM.
 *
 * One line decides whether the whole application talks to the seeded in-memory
 * dataset or to the real ASP.NET Web API. Nothing above this file knows which.
 */
/* Loaded on first request, so the seeded database never ships in the entry bundle or loads on the public site. */
const mockTransport: Transport = async <T,>(spec: RequestSpec): Promise<T> => {
  const adapter = await import('./mock/adapter');
  return adapter.mockTransport<T>(spec);
};

const transport: Transport = config.useMockApi ? mockTransport : httpTransport;

export function request<T>(spec: RequestSpec): Promise<T> {
  return transport<T>(spec);
}

/* ------------------------------------------------------------------ *
 * Resource client — one typed object per table
 * ------------------------------------------------------------------ */

export interface Resource<T> {
  list(query?: ListQuery, signal?: AbortSignal): Promise<PagedResult<T>>;
  get(id: number, signal?: AbortSignal): Promise<T>;
  create(payload: Partial<T>): Promise<T>;
  update(id: number, payload: Partial<T>): Promise<T>;
  /** Soft delete — flips isActive. The row is never removed. */
  deactivate(id: number): Promise<T>;
  /** Convenience for pickers: active rows only, unpaged. */
  options(query?: ListQuery, signal?: AbortSignal): Promise<T[]>;
}

function resource<T>(path: string): Resource<T> {
  return {
    list: (query, signal) => request<PagedResult<T>>({ method: 'GET', path, query, signal }),
    get: (id, signal) => request<T>({ method: 'GET', path: `${path}/${id}`, signal }),
    create: (payload) => request<T>({ method: 'POST', path, body: payload }),
    update: (id, payload) => request<T>({ method: 'PUT', path: `${path}/${id}`, body: payload }),
    deactivate: (id) => request<T>({ method: 'DELETE', path: `${path}/${id}` }),
    async options(query, signal) {
      const result = await request<PagedResult<T>>({
        method: 'GET',
        path,
        query: { isActive: true, pageSize: 500, ...query },
        signal,
      });
      return result.items;
    },
  };
}

export const api = {
  groups: resource<import('./types').GroupMaster>(endpoints.groups),
  subGroups: resource<import('./types').SubGroupMaster>(endpoints.subGroups),
  playerSubTypes: resource<import('./types').PlayerSubTypeMaster>(endpoints.playerSubTypes),
  playerSubTypeDetails: resource<import('./types').PlayerSubTypeDetail>(endpoints.playerSubTypeDetails),
  ruleCards: resource<import('./types').RuleCard>(endpoints.ruleCards),
  players: resource<PlayerMaster>(endpoints.players),
  eventTeam: resource<import('./types').EventTeamMaster>(endpoints.eventTeam),
  formations: resource<import('./types').TeamFormation>(endpoints.formations),
  teams: resource<import('./types').TeamMaster>(endpoints.teams),
  teamAllocations: resource<import('./types').TeamAllocation>(endpoints.teamAllocations),
  teamGroups: resource<import('./types').TeamGroupMaster>(endpoints.teamGroups),
  teamGroupDetails: resource<import('./types').TeamGroupDetail>(endpoints.teamGroupDetails),
  schedules: resource<import('./types').ScheduleMaster>(endpoints.schedules),
  matchResults: resource<import('./types').MatchResult>(endpoints.matchResults),
  events: resource<import('./types').EventMaster>(endpoints.events),
  seasons: resource<import('./types').SeasonMaster>(endpoints.seasons),
  users: resource<import('./types').UserAccount>(endpoints.users),
  rolePermissions: resource<import('./types').RolePermission>(endpoints.rolePermissions),
  umpires: resource<import('./types').UmpireMaster>(endpoints.umpires),
  auditLogs: resource<import('./types').AuditLog>(endpoints.auditLogs),

  /**
   * Bulk classification for the four assignment screens. Send one level per
   * call; the server clears the levels below it (see ClassifyRequest).
   */
  classifyParticipants(payload: ClassifyRequest): Promise<ClassifyResult> {
    return request<ClassifyResult>({
      method: 'POST',
      path: endpoints.classify,
      body: payload as unknown as Record<string, unknown>,
    });
  },

  dashboard(filters: DashboardFilters, signal?: AbortSignal): Promise<DashboardSummary> {
    return request<DashboardSummary>({
      method: 'GET',
      path: endpoints.dashboard,
      query: filters as Record<string, unknown>,
      signal,
    });
  },

  /**
   * The archive. Takes the same filter object the export endpoint takes, so
   * the file and the screen are guaranteed to be the same slice of data.
   */
  history(filters: HistoryFilters, signal?: AbortSignal): Promise<HistoryResult> {
    return request<HistoryResult>({
      method: 'GET',
      path: endpoints.history,
      query: filters as Record<string, unknown>,
      signal,
    });
  },
};

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export const auth = {
  async login(userName: string, password: string, remember = false): Promise<AuthUser> {
    const { body, contentType } = authStrategy.loginRequest(userName, password);

    const payload = await request<Record<string, unknown>>({
      method: 'POST',
      path: authStrategy.loginPath(),
      rawBody: body,
      contentType,
      anonymous: true,
    });

    const { token, expiresIn } = authStrategy.readLoginResponse(payload);

    /* The OWIN token endpoint returns only claims, not a user object. If the
       API does not embed one, fall back to /api/account/me. */
    let user = payload.user as AuthUser | undefined;
    if (!user) {
      tokenStore.save(token, { userId: 0 } as AuthUser, expiresIn, remember);
      try {
        user = await request<AuthUser>({ method: 'GET', path: endpoints.auth.me });
      } catch (cause) {
        /* Otherwise the placeholder user stays stored and the next reload restores a session for nobody. */
        tokenStore.clear();
        throw cause;
      }
    }

    tokenStore.save(token, user, expiresIn, remember);
    return user;
  },

  async logout(): Promise<void> {
    try {
      await request<void>({ method: 'POST', path: endpoints.auth.logout });
    } catch {
      /* A failed logout must still clear the client session. */
    }
    tokenStore.clear();
  },

  me(): Promise<AuthUser> {
    return request<AuthUser>({ method: 'GET', path: endpoints.auth.me });
  },

  forgotPassword(email: string): Promise<{ sent: boolean }> {
    return request({
      method: 'POST',
      path: endpoints.auth.forgotPassword,
      body: { email },
      anonymous: true,
    });
  },

  resetPassword(token: string, newPassword: string): Promise<{ reset: boolean }> {
    return request({
      method: 'POST',
      path: endpoints.auth.resetPassword,
      body: { token, newPassword },
      anonymous: true,
    });
  },

  changePassword(currentPassword: string, newPassword: string): Promise<{ changed: boolean }> {
    return request({
      method: 'POST',
      path: endpoints.auth.changePassword,
      body: { currentPassword, newPassword },
    });
  },

  updateProfile(payload: { displayName: string; email: string }): Promise<AuthUser> {
    return request({ method: 'PUT', path: endpoints.auth.updateProfile, body: payload });
  },
};

/* ------------------------------------------------------------------ *
 * File download
 * ------------------------------------------------------------------ */

const EXTENSIONS: Record<string, string> = { XLS: 'xls', CSV: 'csv', PDF: 'pdf' };

/**
 * Asks the API for a report and hands the browser the file.
 *
 * The object URL is revoked on the next tick — not immediately — because Safari
 * cancels an in-flight download if the URL dies in the same frame as the click.
 */
export async function downloadReport(payload: ExportRequest): Promise<void> {
  const blob = await request<Blob>({
    method: 'POST',
    path: endpoints.exportReport,
    body: payload,
    expectBlob: true,
  });

  const stamp = localIsoDate();
  const name = `csem-${payload.reportType}-${stamp}.${EXTENSIONS[payload.format] ?? 'csv'}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { ApiError, config, endpoints, tokenStore };
export type { PlayerStatus };
export * from './types';
