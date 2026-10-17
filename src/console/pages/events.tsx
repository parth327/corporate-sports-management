import { api } from '@/api';
import type { EventMaster } from '@/api/types';
import { Badge } from '@/ui/primitives';
import { CrudScreen } from '../Crud';
import { SOURCE } from './sources';

/**
 * Event scheduling — the container everything else is stamped with.
 *
 * An event carries a code, a name, the season it runs in (which is where the
 * year comes from), an optional group / sub-group scope, and the window it
 * runs between. Leaving the scope empty means the event spans the whole
 * company; pinning it narrows what match scheduling will offer.
 *
 * Declared against the generic CRUD engine rather than hand-written: the only
 * cross-field rules — code uniqueness, sub-group belonging to the chosen
 * group, and the end date not preceding the start — are all server-side, and
 * the engine already maps field errors back onto the control that caused them.
 */

const scopeLabel = (r: EventMaster) => {
  if (r.subGroupName) return `${r.groupName ?? '—'} · ${r.subGroupName}`;
  if (r.groupName) return `${r.groupName} · all sub-groups`;
  return null;
};

export function EventSchedulingPage() {
  return (
    <CrudScreen<EventMaster & Record<string, unknown>>
      eyebrow="Events"
      title="Event scheduling"
      entity="Event"
      description="The yearly isolation key. Every team, allocation, fixture and report is stamped with an event, so 2025's moderators and rosters never collide with 2026's. Leave the group empty for an event that spans the whole company."
      resource={api.events as never}
      idField="eventId"
      capability="events"
      searchPlaceholder="Search event code or name…"
      columns={[
        {
          key: 'eventCode',
          header: 'Code',
          render: (r) => <span className="font-mono text-[12.5px] text-accent-solar">{r.eventCode}</span>,
        },
        {
          key: 'eventName',
          header: 'Event',
          primary: true,
          selfLinking: true,
          render: (r) => (
            <div className="min-w-0">
              <span className="block truncate font-semibold text-fg">{r.eventName}</span>
              <span className="block truncate text-[12px] text-fg/58">
                {scopeLabel(r) ?? 'All groups'}
              </span>
            </div>
          ),
        },
        {
          key: 'year',
          header: 'Year',
          align: 'center',
          render: (r) => <span className="tabular-nums">{r.year ?? '—'}</span>,
        },
        {
          key: 'window',
          header: 'From — to',
          render: (r) => (
            <span className="font-mono text-[12.5px]">
              {r.startDate} <span className="text-fg/45">→</span> {r.endDate}
            </span>
          ),
        },
        {
          key: 'isCurrent',
          header: 'Current',
          align: 'center',
          render: (r) =>
            r.isCurrent ? (
              <Badge tone="success" glyph="●">
                Live
              </Badge>
            ) : (
              <span className="text-fg/45">—</span>
            ),
        },
      ]}
      fields={[
        {
          name: 'eventCode',
          label: 'Event code',
          type: 'text',
          required: true,
          maxLength: 30,
          placeholder: 'CPL-2026',
          hint: 'Short, unique. Appears on exports and rule cards.',
        },
        { name: 'eventName', label: 'Event name', type: 'text', required: true, maxLength: 140, placeholder: 'Corporate Premier League 2026' },
        {
          name: 'seasonId',
          label: 'Season / year',
          type: 'select',
          required: true,
          source: { resource: SOURCE.seasons, valueKey: 'seasonId', labelKey: 'seasonName' },
          hint: 'The season supplies the reporting year',
        },
        {
          name: 'isCurrent',
          label: 'This is the current event',
          type: 'checkbox',
          /* Off by default. The engine defaults a checkbox to true, which is
             right for `isActive` and wrong here: setting this demotes whatever
             is live, so adding a one-off knockout would quietly unseat the
             league it belongs to. */
          defaultValue: false,
          hint: 'New records are stamped with the current event. Only one can be current — setting this clears the others.',
        },
        {
          name: 'groupId',
          label: 'Group',
          type: 'select',
          source: { resource: SOURCE.groups, valueKey: 'groupId', labelKey: 'groupName' },
          hint: 'Leave empty for an event that spans every group',
        },
        {
          name: 'subGroupId',
          label: 'Sub-group',
          type: 'select',
          source: {
            resource: SOURCE.subGroups,
            valueKey: 'subGroupId',
            labelKey: 'subGroupName',
            dependsOn: 'groupId',
            query: (values) => ({ groupId: Number(values.groupId) || undefined }),
          },
          hint: 'Leave empty for every sub-group in the chosen group',
        },
        { name: 'startDate', label: 'From date', type: 'date', required: true },
        { name: 'endDate', label: 'To date', type: 'date', required: true },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}
