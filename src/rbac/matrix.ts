import type { Capability, CapabilityAction, Role } from '@/api/types';

/**
 * Section 07 of the blueprint, as data.
 *
 * This drives what the interface offers. It is NOT a security boundary — the
 * same matrix must be enforced on the server. As the blueprint puts it: a hidden
 * menu item is not a permission.
 */

export type Grant = Record<CapabilityAction, boolean>;

const all: Grant = { view: true, create: true, edit: true, deactivate: true };
const view: Grant = { view: true, create: false, edit: false, deactivate: false };
const viewEdit: Grant = { view: true, create: false, edit: true, deactivate: false };
const none: Grant = { view: false, create: false, edit: false, deactivate: false };

export const MATRIX: Record<Role, Record<Capability, Grant>> = {
  /* Everything, everywhere. The only role that may change the shape of the
     system rather than the data inside it. */
  MainAdmin: {
    dashboard: all,
    participants: all,
    integration: all,
    masters: all,
    teams: all,
    formations: all,
    teamBuilder: all,
    allocation: all,
    teamGroups: all,
    events: all,
    schedule: all,
    results: all,
    rules: all,
    users: all,
    permissions: all,
    audit: all,
    exports: all,
  },

  /* Classifies people and builds squads. It may not invent a participant — the
     register is fed by the HR API — but it decides which group, sub-group and
     type each one lands in, which is the whole job. Cannot touch masters,
     users, rights or the event calendar. */
  ManagementTeam: {
    dashboard: view,
    participants: viewEdit,
    integration: all,
    masters: view,
    teams: all,
    /* Reads the formation to know what the squad must look like, but the
       shape itself is the Main Admin's to set. */
    formations: view,
    teamBuilder: all,
    allocation: all,
    teamGroups: all,
    events: view,
    schedule: view,
    results: none,
    rules: view,
    users: none,
    permissions: none,
    audit: none,
    exports: view,
  },

  /* Runs an event once the Main Admin has created it: fixtures, rule cards and
     results. Deliberately cannot re-classify participants or rebuild squads —
     that separation is what stops a result entry from quietly reshaping the
     team it was scored against. */
  EventManagement: {
    dashboard: view,
    participants: view,
    integration: none,
    masters: view,
    teams: view,
    formations: view,
    teamBuilder: none,
    allocation: view,
    teamGroups: view,
    events: viewEdit,
    schedule: all,
    results: all,
    rules: all,
    users: none,
    permissions: none,
    audit: none,
    exports: view,
  },

  /* The marketing site and nothing else. Self-registration is gone, so this
     role no longer carries even the create grant it once had. */
  Public: {
    dashboard: none,
    participants: none,
    integration: none,
    masters: none,
    teams: none,
    formations: none,
    teamBuilder: none,
    allocation: none,
    teamGroups: none,
    events: none,
    schedule: none,
    results: none,
    rules: none,
    users: none,
    permissions: none,
    audit: none,
    exports: none,
  },
};

export type Scope = 'Global' | 'SubGroup' | 'None';

export const SCOPE_BY_ROLE: Record<Role, Scope> = {
  MainAdmin: 'Global',
  ManagementTeam: 'SubGroup',
  EventManagement: 'SubGroup',
  Public: 'None',
};

/** Shown wherever a role needs a human name — nav footer, user admin, audit. */
export const ROLE_LABELS: Record<Role, string> = {
  MainAdmin: 'Main Admin',
  ManagementTeam: 'Management Team',
  EventManagement: 'Event Management',
  Public: 'Public',
};

export function can(role: Role, capability: Capability, action: CapabilityAction = 'view'): boolean {
  return MATRIX[role]?.[capability]?.[action] ?? false;
}

/**
 * The sub-group a user's queries must be pinned to, or null for global reach.
 * Every list screen merges this into its query so an Event Team user physically
 * cannot request rows outside their scope.
 */
export function scopeFilter(
  role: Role,
  subGroupId: number | null,
): { subGroupId?: number } {
  if (SCOPE_BY_ROLE[role] === 'SubGroup' && subGroupId !== null) return { subGroupId };
  return {};
}
