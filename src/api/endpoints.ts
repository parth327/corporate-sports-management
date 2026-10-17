/**
 * Every URL the app knows about, in one file.
 *
 * If your ASP.NET routes differ from these defaults, change them HERE and
 * nowhere else. The resource names line up with a conventional Web API
 * `RouteConfig` using `api/{controller}/{id}`, so `GroupsController` serves
 * `/api/groups`.
 */

export const endpoints = {
  auth: {
    /** Overridden by the auth strategy — kept here for reference only. */
    login: '/token',
    logout: '/api/account/logout',
    me: '/api/account/me',
    forgotPassword: '/api/account/forgot-password',
    resetPassword: '/api/account/reset-password',
    changePassword: '/api/account/change-password',
    updateProfile: '/api/account/profile',
  },

  /* Master data */
  groups: '/api/groups',
  subGroups: '/api/subgroups',
  playerSubTypes: '/api/playersubtypes',
  playerSubTypeDetails: '/api/playersubtypedetails',
  ruleCards: '/api/rulecards',

  /* Participants */
  players: '/api/players',
  /** Bulk classification: group -> sub-group -> type -> type detail. */
  classify: '/api/players/classify',
  eventTeam: '/api/eventteam',

  /* Teams & competition */
  formations: '/api/formations',
  teams: '/api/teams',
  teamAllocations: '/api/teamallocations',
  teamGroups: '/api/teamgroups',
  teamGroupDetails: '/api/teamgroupdetails',
  schedules: '/api/schedules',
  matchResults: '/api/matchresults',

  /* Support */
  events: '/api/events',
  seasons: '/api/seasons',
  users: '/api/users',
  rolePermissions: '/api/rolepermissions',
  umpires: '/api/umpires',
  auditLogs: '/api/auditlogs',

  /* Reporting */
  dashboard: '/api/dashboard/summary',
  history: '/api/history',
  exportReport: '/api/reports/export',
} as const;

export type ResourcePath = string;
