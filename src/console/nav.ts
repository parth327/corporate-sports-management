import type { Capability, CapabilityAction, Role } from '@/api/types';

/**
 * The console's information architecture.
 *
 * Each item declares the capability it needs. The sidebar renders only what the
 * signed-in role can actually reach, and the route guard re-checks the same
 * declaration — so a hand-typed URL is refused, not just hidden.
 */

export interface NavItem {
  to: string;
  label: string;
  glyph: string;
  capability: Capability;
  action?: CapabilityAction;
  /** Restrict to specific roles on top of the capability check. */
  roles?: Role[];
  description?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        to: '/console',
        label: 'Dashboard',
        glyph: '◫',
        capability: 'dashboard',
        description: 'Participation, teams, schedule and activity at a glance',
      },
    ],
  },
  {
    title: 'Participants',
    items: [
      {
        to: '/console/participants',
        label: 'Participant register',
        glyph: '◈',
        capability: 'participants',
        description: 'Everyone on the HR feed, with their classification',
      },
      {
        to: '/console/event-team',
        label: 'Event team',
        glyph: '⚑',
        capability: 'masters',
        description: 'Moderators, co-moderators, timekeepers and members',
      },
    ],
  },
  {
    /* The classification pipeline, in the order it has to be walked: an
       participant cannot be given a type before it has a sub-group, and cannot
       have a sub-group before it has a group. */
    title: 'Classification',
    items: [
      {
        to: '/console/integration/groups',
        label: 'Group assignment',
        glyph: '▣',
        capability: 'integration',
        description: 'Put participants into Sports, Cultural or None',
      },
      {
        to: '/console/integration/sub-groups',
        label: 'Sub-group assignment',
        glyph: '▤',
        capability: 'integration',
        description: 'Cricket, Football, Cultural — within a chosen group',
      },
      {
        to: '/console/integration/types',
        label: 'Participant types',
        glyph: '◐',
        capability: 'integration',
        description: 'Batsman, bowler, keeper — drag to classify',
      },
      {
        to: '/console/integration/type-details',
        label: 'Type detail',
        glyph: '◑',
        capability: 'integration',
        description: 'Openers, middle order, pace, spin',
      },
    ],
  },
  {
    title: 'Competition',
    items: [
      { to: '/console/teams', label: 'Teams', glyph: '⬢', capability: 'teams' },
      {
        to: '/console/formations',
        label: 'Team formation',
        glyph: '⬡',
        capability: 'formations',
        action: 'edit',
        description: 'Squad size and per-type ceilings',
      },
      {
        to: '/console/team-builder',
        label: 'Team builder',
        glyph: '⌂',
        capability: 'teamBuilder',
        description: 'Fill the squad against the stadium map',
      },
      { to: '/console/allocation', label: 'Team allocation', glyph: '⇄', capability: 'allocation' },
      { to: '/console/team-groups', label: 'Team groups', glyph: '◇', capability: 'teamGroups' },
    ],
  },
  {
    title: 'Events',
    items: [
      {
        to: '/console/events-hub',
        label: 'Event hub',
        glyph: '◈',
        capability: 'events',
        roles: ['EventManagement'],
        description: 'What needs attention today, across scheduling, rules and results',
      },
      { to: '/console/events', label: 'Event scheduling', glyph: '◷', capability: 'events' },
      { to: '/console/schedule', label: 'Match scheduling', glyph: '▤', capability: 'schedule' },
      { to: '/console/results', label: 'Results & winners', glyph: '★', capability: 'results' },
      { to: '/console/rules', label: 'Rule cards', glyph: '§', capability: 'rules' },
    ],
  },
  {
    title: 'Master setup',
    items: [
      { to: '/console/masters/groups', label: 'Groups', glyph: '▣', capability: 'masters', action: 'edit' },
      { to: '/console/masters/sub-groups', label: 'Sub-groups', glyph: '▤', capability: 'masters', action: 'edit' },
      { to: '/console/masters/player-types', label: 'Type master', glyph: '◐', capability: 'masters', action: 'edit' },
      { to: '/console/masters/player-type-details', label: 'Type detail master', glyph: '◑', capability: 'masters', action: 'edit' },
      { to: '/console/masters/umpires', label: 'Umpires', glyph: '⚖', capability: 'masters', action: 'edit' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/console/admin/users', label: 'User accounts', glyph: '⚿', capability: 'users' },
      { to: '/console/admin/permissions', label: 'Role rights', glyph: '⛭', capability: 'permissions' },
      { to: '/console/admin/audit', label: 'Audit log', glyph: '◷', capability: 'audit' },
    ],
  },
  {
    title: 'Reporting',
    items: [
      {
        to: '/console/history',
        label: 'History',
        glyph: '▦',
        capability: 'exports',
        description: 'Every played match by year, season, event and fixture',
      },
      {
        to: '/console/reports',
        label: 'Exports',
        glyph: '↧',
        capability: 'exports',
        description: 'Excel, PDF and CSV from the same filtered dataset',
      },
    ],
  },
];

export function visibleSections(
  role: Role,
  can: (capability: Capability, action?: CapabilityAction) => boolean,
): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        can(item.capability, item.action ?? 'view') && (!item.roles || item.roles.includes(role)),
    ),
  })).filter((section) => section.items.length > 0);
}

/** Flat lookup used by the route guard. */
export function findNavItem(pathname: string): NavItem | undefined {
  const all = NAV.flatMap((s) => s.items);
  return (
    all.find((item) => item.to === pathname) ??
    all
      .filter((item) => item.to !== '/console' && pathname.startsWith(item.to))
      .sort((a, b) => b.to.length - a.to.length)[0]
  );
}
