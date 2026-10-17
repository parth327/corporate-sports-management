import { api } from '@/api';
import type {
  EventTeamMaster,
  GroupMaster,
  PlayerSubTypeDetail,
  PlayerSubTypeMaster,
  RuleCard,
  SubGroupMaster,
  UmpireMaster,
  UserAccount,
} from '@/api/types';
import { EVENT_TEAM_ROLES } from '@/api/types';
import { ROLE_LABELS } from '@/rbac/matrix';
import { Dash, MailLink, PhoneLink } from '@/ui/primitives';
import { CrudScreen } from '../Crud';
import { SOURCE } from './sources';

/**
 * Forms 6-15 of the blueprint, declared rather than written.
 *
 * Each screen is a column list plus a field list. The generic engine supplies
 * the dialog, validation, scope pinning, soft delete and pagination.
 *
 * Event scheduling used to live here as a plain master. It moved to
 * events.tsx when events grew a code and a group/sub-group scope — it is a
 * scheduling screen now, not reference data.
 */

/* ------------------------------------------------------------------ *
 * Form 6 — GroupMaster
 * ------------------------------------------------------------------ */

export function GroupsPage() {
  return (
    <CrudScreen<GroupMaster & Record<string, unknown>>
      eyebrow="Master setup"
      title="Groups"
      entity="Group"
      description="The top-level activity classification: Sports, Cultural and None. Everything else in the system hangs off these."
      resource={api.groups as never}
      idField="groupId"
      capability="masters"
      searchPlaceholder="Search group name…"
      columns={[
        { key: 'groupName', header: 'Group', primary: true, render: (r) => <span className="font-semibold text-fg">{r.groupName}</span> },
        { key: 'description', header: 'Description', render: (r) => r.description || <span className="text-fg/45">—</span> },
        { key: 'displayOrder', header: 'Order', align: 'center', render: (r) => <span className="tabular-nums">{r.displayOrder}</span> },
      ]}
      fields={[
        { name: 'groupName', label: 'Group name', type: 'text', required: true, maxLength: 80, placeholder: 'e.g. Sports' },
        { name: 'displayOrder', label: 'Display order', type: 'number', required: true, min: 1, defaultValue: 1, hint: 'Controls the order shown to the public' },
        { name: 'description', label: 'Description', type: 'textarea', span: 2, maxLength: 400 },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2, hint: 'Inactive groups cannot be selected on new registrations' },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form 7 — SubGroupMaster
 * ------------------------------------------------------------------ */

export function SubGroupsPage() {
  return (
    <CrudScreen<SubGroupMaster & Record<string, unknown>>
      eyebrow="Master setup"
      title="Sub-groups"
      entity="Sub-group"
      description="Cricket and Football under Sports; Cultural-1 and Cultural-2 under Cultural. A sub-group is the unit an Event Team user is scoped to."
      resource={api.subGroups as never}
      idField="subGroupId"
      capability="masters"
      searchPlaceholder="Search sub-group…"
      columns={[
        { key: 'subGroupName', header: 'Sub-group', primary: true, render: (r) => <span className="font-semibold text-fg">{r.subGroupName}</span> },
        { key: 'groupName', header: 'Parent group', render: (r) => r.groupName ?? '—' },
        { key: 'description', header: 'Description', secondary: true, render: (r) => r.description || <span className="text-fg/45">—</span> },
        { key: 'displayOrder', header: 'Order', align: 'center', render: (r) => <span className="tabular-nums">{r.displayOrder}</span> },
      ]}
      fields={[
        {
          name: 'groupId', label: 'Parent group', type: 'select', required: true,
          source: { resource: SOURCE.groups, valueKey: 'groupId', labelKey: 'groupName' },
        },
        { name: 'subGroupName', label: 'Sub-group name', type: 'text', required: true, maxLength: 80, placeholder: 'e.g. Cricket' },
        { name: 'displayOrder', label: 'Display order', type: 'number', required: true, min: 1, defaultValue: 1 },
        { name: 'description', label: 'Description', type: 'textarea', span: 2, maxLength: 400 },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form 8 — PlayerSubTypeMaster
 * ------------------------------------------------------------------ */

export function PlayerTypesPage() {
  return (
    <CrudScreen<PlayerSubTypeMaster & Record<string, unknown>>
      eyebrow="Master setup"
      title="Participant types"
      entity="Participant type"
      description="Batsman, Bowler, Wicket-keeper and Other support for Cricket; the equivalent positions for Football. These are the buckets the type-assignment screen drags participants into."
      resource={api.playerSubTypes as never}
      idField="playerSubTypeId"
      capability="masters"
      scopeField="subGroupId"
      searchPlaceholder="Search type name…"
      columns={[
        { key: 'subTypeName', header: 'Participant type', primary: true, render: (r) => <span className="font-semibold text-fg">{r.subTypeName}</span> },
        { key: 'subGroupName', header: 'Sub-group', render: (r) => r.subGroupName ?? '—' },
        { key: 'displayOrder', header: 'Order', align: 'center', render: (r) => <span className="tabular-nums">{r.displayOrder}</span> },
      ]}
      fields={[
        {
          name: 'subGroupId', label: 'Sub-group', type: 'select', required: true,
          source: { resource: SOURCE.subGroups, valueKey: 'subGroupId', labelKey: 'subGroupName' },
        },
        { name: 'subTypeName', label: 'Type name', type: 'text', required: true, maxLength: 60, placeholder: 'e.g. Bowler' },
        { name: 'displayOrder', label: 'Display order', type: 'number', required: true, min: 1, defaultValue: 1 },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form 9 — PlayerSubTypeDetail
 * ------------------------------------------------------------------ */

export function PlayerTypeDetailsPage() {
  return (
    <CrudScreen<PlayerSubTypeDetail & Record<string, unknown>>
      eyebrow="Master setup"
      title="Sub-type details"
      entity="Sub-type detail"
      description="The third level of classification — Spin, Pace and Medium under Bowler. Offered on the type-detail screen only when the chosen participant type has details configured."
      resource={api.playerSubTypeDetails as never}
      idField="playerSubTypeDetailId"
      capability="masters"
      searchPlaceholder="Search detail name…"
      columns={[
        { key: 'detailName', header: 'Detail', primary: true, render: (r) => <span className="font-semibold text-fg">{r.detailName}</span> },
        { key: 'playerSubTypeName', header: 'Participant type', render: (r) => r.playerSubTypeName ?? '—' },
        { key: 'displayOrder', header: 'Order', align: 'center', render: (r) => <span className="tabular-nums">{r.displayOrder}</span> },
      ]}
      fields={[
        {
          name: 'playerSubTypeId', label: 'Participant type', type: 'select', required: true,
          source: { resource: SOURCE.playerSubTypes, valueKey: 'playerSubTypeId', labelKey: 'subTypeName' },
        },
        { name: 'detailName', label: 'Detail name', type: 'text', required: true, maxLength: 60, placeholder: 'e.g. Spin' },
        { name: 'displayOrder', label: 'Display order', type: 'number', required: true, min: 1, defaultValue: 1 },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form 10 — RuleCard
 * ------------------------------------------------------------------ */

export function RulesPage() {
  return (
    <CrudScreen<RuleCard & Record<string, unknown>>
      eyebrow="Competition"
      title="Rule cards"
      entity="Rule card"
      description="Playing conditions published per sub-group. Versioned and dated so a mid-season amendment never silently rewrites what was played under."
      resource={api.ruleCards as never}
      idField="ruleId"
      capability="rules"
      scopeField="subGroupId"
      dialogSize="lg"
      searchPlaceholder="Search rule title…"
      columns={[
        { key: 'ruleTitle', header: 'Title', primary: true, render: (r) => <span className="font-semibold text-fg">{r.ruleTitle}</span> },
        { key: 'subGroupName', header: 'Sub-group', render: (r) => r.subGroupName ?? '—' },
        { key: 'version', header: 'Version', render: (r) => <span className="font-mono text-[12.5px]">{r.version}</span> },
        { key: 'effectiveDate', header: 'Effective', render: (r) => r.effectiveDate },
      ]}
      fields={[
        {
          name: 'subGroupId', label: 'Sub-group', type: 'select', required: true,
          source: { resource: SOURCE.subGroups, valueKey: 'subGroupId', labelKey: 'subGroupName' },
        },
        { name: 'ruleTitle', label: 'Rule title', type: 'text', required: true, maxLength: 140 },
        { name: 'version', label: 'Version', type: 'text', required: true, placeholder: 'v1.0', maxLength: 20 },
        { name: 'effectiveDate', label: 'Effective from', type: 'date', required: true },
        {
          name: 'ruleBody', label: 'Rule body', type: 'textarea', required: true, span: 2,
          hint: 'One clause per line', maxLength: 6000,
        },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form 12 — UserAccount
 * ------------------------------------------------------------------ */

export function UsersPage() {
  return (
    <CrudScreen<UserAccount & Record<string, unknown>>
      eyebrow="Administration"
      title="User accounts"
      entity="User"
      description="Sign-in accounts for the Main Admin and Event Team. An Event Team account must carry a sub-group — that assignment is what scopes everything they see."
      resource={api.users as never}
      idField="userId"
      capability="users"
      searchPlaceholder="Search username or name…"
      columns={[
        {
          key: 'displayName',
          header: 'Name',
          primary: true,
          selfLinking: true,
          render: (r) => (
            <div className="min-w-0">
              <span className="block truncate font-semibold text-fg">{r.displayName}</span>
              <span className="block truncate text-[12px]">
                <MailLink email={r.email} />
              </span>
            </div>
          ),
        },
        { key: 'userName', header: 'Username', render: (r) => <span className="font-mono text-[12.5px]">{r.userName}</span> },
        { key: 'role', header: 'Role', render: (r) => ROLE_LABELS[r.role] ?? r.role },
        { key: 'subGroupName', header: 'Scope', render: (r) => r.subGroupName ?? <span className="text-fg/68">All groups</span> },
        { key: 'lastLoginOn', header: 'Last sign-in', secondary: true, render: (r) => (r.lastLoginOn ? String(r.lastLoginOn).slice(0, 10) : <span className="text-fg/45">Never</span>) },
      ]}
      fields={[
        { name: 'displayName', label: 'Display name', type: 'text', required: true, maxLength: 120 },
        { name: 'userName', label: 'Username', type: 'text', required: true, maxLength: 60, hint: 'Used to sign in' },
        { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
        {
          name: 'password', label: 'Initial password', type: 'password', required: true, only: 'create',
          hint: 'The user is prompted to change this on first sign-in',
        },
        {
          name: 'role', label: 'Role', type: 'select', required: true,
          options: [
            { value: 'MainAdmin', label: 'Main Admin — global rights' },
            { value: 'ManagementTeam', label: 'Management Team — classifies participants, builds squads' },
            { value: 'EventManagement', label: 'Event Management — fixtures, rules, results' },
          ],
        },
        {
          name: 'subGroupId', label: 'Assigned sub-group', type: 'select',
          source: { resource: SOURCE.subGroups, valueKey: 'subGroupId', labelKey: 'subGroupName' },
          hint: 'Required for Management Team and Event Management; leave empty for Main Admin',
        },
        { name: 'isActive', label: 'Account active', type: 'checkbox', span: 2, hint: 'A deactivated account cannot sign in' },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form 14 — UmpireMaster
 * ------------------------------------------------------------------ */

export function UmpiresPage() {
  return (
    <CrudScreen<UmpireMaster & Record<string, unknown>>
      eyebrow="Master setup"
      title="Umpires & officials"
      entity="Official"
      description="The officials register. Leaving the sub-group empty makes an official available to every competition. Booking conflicts are blocked on the fixture form."
      resource={api.umpires as never}
      idField="umpireId"
      capability="masters"
      searchPlaceholder="Search official name…"
      columns={[
        {
          key: 'umpireName',
          header: 'Official',
          primary: true,
          selfLinking: true,
          render: (r) => (
            <div className="min-w-0">
              <span className="block truncate font-semibold text-fg">{r.umpireName}</span>
              <span className="block truncate text-[12px]">
                <MailLink email={r.email} />
              </span>
            </div>
          ),
        },
        { key: 'contactNo', header: 'Contact', render: (r) => <PhoneLink phone={r.contactNo} /> },
        { key: 'accreditationLevel', header: 'Accreditation', render: (r) => r.accreditationLevel || <Dash /> },
        { key: 'subGroupName', header: 'Availability', render: (r) => r.subGroupName ?? <span className="text-fg/68">All sub-groups</span> },
      ]}
      fields={[
        { name: 'umpireName', label: 'Official name', type: 'text', required: true, maxLength: 120 },
        { name: 'contactNo', label: 'Contact number', type: 'tel', required: true },
        { name: 'email', label: 'Email', type: 'email', hint: 'Used for fixture notifications' },
        { name: 'accreditationLevel', label: 'Accreditation / level', type: 'text', maxLength: 80, placeholder: 'e.g. Certified Level 2' },
        {
          name: 'subGroupId', label: 'Sub-group availability', type: 'select',
          source: { resource: SOURCE.subGroups, valueKey: 'subGroupId', labelKey: 'subGroupName' },
          hint: 'Leave empty for all sub-groups',
        },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Form 15 — EventTeamMaster
 * ------------------------------------------------------------------ */

export function EventTeamPage() {
  return (
    <CrudScreen<EventTeamMaster & Record<string, unknown>>
      eyebrow="Participants"
      title="Event team"
      entity="Member"
      description="Moderators, co-moderators, timekeepers and members, recorded per event so the yearly rotation is history rather than an overwrite."
      resource={api.eventTeam as never}
      idField="eventTeamId"
      capability="masters"
      scopeField="subGroupId"
      searchPlaceholder="Search member name…"
      columns={[
        {
          key: 'memberName',
          header: 'Member',
          primary: true,
          selfLinking: true,
          render: (r) => (
            <div className="min-w-0">
              <span className="block truncate font-semibold text-fg">{r.memberName}</span>
              <span className="block truncate text-[12px]">
                <MailLink email={r.email} />
              </span>
            </div>
          ),
        },
        { key: 'role', header: 'Role', render: (r) => String(r.role).replace(/([A-Z])/g, ' $1').trim() },
        { key: 'subGroupName', header: 'Sub-group', render: (r) => r.subGroupName ?? <Dash /> },
        { key: 'contactNo', header: 'Contact', secondary: true, render: (r) => <PhoneLink phone={r.contactNo} /> },
      ]}
      fields={[
        { name: 'memberName', label: 'Member name', type: 'text', required: true, maxLength: 120 },
        {
          name: 'role', label: 'Role', type: 'select', required: true,
          options: EVENT_TEAM_ROLES.map((role) => ({
            value: role,
            label: role.replace(/([A-Z])/g, ' $1').trim(),
          })),
        },
        { name: 'contactNo', label: 'Contact number', type: 'tel', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        {
          name: 'subGroupId', label: 'Sub-group', type: 'select', required: true,
          source: { resource: SOURCE.subGroups, valueKey: 'subGroupId', labelKey: 'subGroupName' },
        },
        {
          name: 'eventId', label: 'Event', type: 'select', required: true,
          source: { resource: SOURCE.events, valueKey: 'eventId', labelKey: 'eventName' },
        },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}
