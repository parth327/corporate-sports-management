import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type Resource, type TeamGroupMaster, type TeamMaster } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useList, useMutation, useOptions } from '@/hooks/useResource';
import { Modal } from '@/ui/Modal';
import { Badge, Button, ErrorPanel, Field, Spinner } from '@/ui/primitives';
import { CrudScreen } from '../Crud';

const asSource = <T,>(resource: Resource<T>) => resource as unknown as Resource<Record<string, unknown>>;

/* ------------------------------------------------------------------ *
 * Form 18 — TeamMaster
 * ------------------------------------------------------------------ */

export function TeamsPage() {
  return (
    <CrudScreen<TeamMaster & Record<string, unknown>>
      eyebrow="Competition"
      title="Teams"
      entity="Team"
      description="Teams belong to exactly one sub-group and carry a capacity ceiling. The ceiling is enforced when participants are allocated, not merely displayed."
      resource={api.teams as never}
      idField="teamId"
      capability="teams"
      scopeField="subGroupId"
      searchPlaceholder="Search team name or code…"
      rowActions={(r) => (
        <Link
          to={`/console/allocation?team=${r.teamId}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-fg/[0.07] px-4 py-2 text-[13px] font-semibold text-fg/88 transition-colors hover:bg-fg/[0.12] hover:text-fg"
        >
          Squad →
        </Link>
      )}
      columns={[
        {
          key: 'teamName',
          header: 'Team',
          primary: true,
          selfLinking: true,
          render: (r) => (
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-sm border border-fg/26"
                style={{ background: r.colorHex ?? 'transparent' }}
              />
              <Link
                to={`/console/allocation?team=${r.teamId}`}
                onClick={(event) => event.stopPropagation()}
                className="inline-block font-semibold text-fg underline-offset-4 hover:underline coarse:-my-2.5 coarse:py-2.5"
              >
                {r.teamName}
              </Link>
            </span>
          ),
        },
        { key: 'teamCode', header: 'Code', render: (r) => <span className="font-mono text-[12.5px]">{r.teamCode}</span> },
        { key: 'subGroupName', header: 'Sub-group', render: (r) => r.subGroupName ?? '—' },
        {
          key: 'roster',
          header: 'Roster',
          align: 'right',
          render: (r) => {
            const allocated = Number(r.allocatedCount ?? 0);
            const capacity = Number(r.maxPlayers);
            const full = allocated >= capacity;
            return (
              <span className="inline-flex items-center gap-2">
                <span className="tabular-nums text-fg/86">
                  {allocated}/{capacity}
                </span>
                <Badge tone={full ? 'success' : 'warning'} glyph={full ? '●' : '◐'}>
                  {full ? 'Full' : 'Short'}
                </Badge>
              </span>
            );
          },
        },
      ]}
      fields={[
        {
          name: 'subGroupId', label: 'Sub-group', type: 'select', required: true,
          source: { resource: asSource(api.subGroups), valueKey: 'subGroupId', labelKey: 'subGroupName' },
        },
        {
          name: 'eventId', label: 'Event', type: 'select', required: true,
          source: { resource: asSource(api.events), valueKey: 'eventId', labelKey: 'eventName' },
        },
        { name: 'teamName', label: 'Team name', type: 'text', required: true, maxLength: 80 },
        { name: 'teamCode', label: 'Short code', type: 'text', required: true, maxLength: 5, hint: 'Three letters, shown on the fixture grid' },
        {
          name: 'formationId', label: 'Formation', type: 'select',
          source: {
            resource: asSource(api.formations),
            valueKey: 'formationId',
            labelKey: 'formationName',
            dependsOn: 'subGroupId',
            query: (values) => ({ subGroupId: Number(values.subGroupId) || undefined }),
          },
          hint: 'The shape the squad builder draws slots from',
        },
        {
          name: 'maxPlayers', label: 'Maximum participants', type: 'number', required: true, min: 1, max: 40, defaultValue: 12,
          hint: 'Allocation is blocked once this is reached',
        },
        { name: 'colorHex', label: 'Team colour', type: 'text', placeholder: '#C72D86', maxLength: 7, hint: 'Hex value used on the grid' },
        { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Forms 20 + 21 — TeamGroupMaster, with the TeamGroupDetail junction
 * ------------------------------------------------------------------ */

export function TeamGroupsPage() {
  const [managing, setManaging] = useState<TeamGroupMaster | null>(null);

  return (
    <>
      <CrudScreen<TeamGroupMaster & Record<string, unknown>>
        eyebrow="Competition"
        title="Team groups"
        entity="Team group"
        description="Group A, Group B and so on, inside a sub-group. Membership is a relationship in a junction table — never a comma-separated column — so it can be queried, validated and reported on."
        resource={api.teamGroups as never}
        idField="teamGroupId"
        capability="teamGroups"
        scopeField="subGroupId"
        searchPlaceholder="Search group name…"
        columns={[
          { key: 'groupName', header: 'Group', primary: true, render: (r) => <span className="font-semibold text-fg">{r.groupName}</span> },
          { key: 'subGroupName', header: 'Sub-group', render: (r) => r.subGroupName ?? '—' },
          {
            key: 'teamCount',
            header: 'Teams',
            align: 'center',
            render: (r) => <span className="tabular-nums text-fg/86">{Number(r.teamCount ?? 0)}</span>,
          },
          {
            key: 'manage',
            header: 'Membership',
            align: 'right',
            render: (r) => (
              <Button variant="subtle" size="sm" onClick={() => setManaging(r)}>
                Manage teams
              </Button>
            ),
          },
        ]}
        fields={[
          {
            name: 'subGroupId', label: 'Sub-group', type: 'select', required: true,
            source: { resource: asSource(api.subGroups), valueKey: 'subGroupId', labelKey: 'subGroupName' },
          },
          {
            name: 'eventId', label: 'Event', type: 'select', required: true,
            source: { resource: asSource(api.events), valueKey: 'eventId', labelKey: 'eventName' },
          },
          { name: 'groupName', label: 'Group name', type: 'text', required: true, span: 2, maxLength: 60, placeholder: 'e.g. Group A' },
          { name: 'isActive', label: 'Active', type: 'checkbox', span: 2 },
        ]}
      />

      <GroupMembershipDialog group={managing} onClose={() => setManaging(null)} />
    </>
  );
}

/**
 * Form 21 — TeamGroupDetail.
 *
 * Presented as a membership picker rather than a CRUD list of junction rows,
 * because nobody thinks in terms of "create a TeamGroupDetail". They think
 * "put these four teams in Group A".
 */
function GroupMembershipDialog({
  group,
  onClose,
}: {
  group: TeamGroupMaster | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { scope } = useAuth();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { options: teams, loading: teamsLoading } = useOptions(
    api.teams,
    { subGroupId: group?.subGroupId ?? scope.subGroupId },
    { enabled: Boolean(group) },
  );

  const membership = useList(
    api.teamGroupDetails,
    { teamGroupId: group?.teamGroupId, isActive: true, pageSize: 200 },
    { enabled: Boolean(group) },
  );

  /* Seed the picker from what is already saved. */
  useEffect(() => {
    if (!group) return;
    setSelected(new Set(membership.items.map((d) => d.teamId)));
  }, [group, membership.items]);

  const save = useMutation(async () => {
    if (!group) return;

    const existing = new Map(membership.items.map((d) => [d.teamId, d.teamGroupDetailId]));

    const toAdd = [...selected].filter((teamId) => !existing.has(teamId));
    const toRemove = [...existing.entries()].filter(([teamId]) => !selected.has(teamId));

    for (const teamId of toAdd) {
      await api.teamGroupDetails.create({
        teamGroupId: group.teamGroupId,
        teamId,
        isActive: true,
      });
    }
    for (const [, detailId] of toRemove) {
      await api.teamGroupDetails.deactivate(detailId);
    }
  });

  const submit = async () => {
    try {
      await save.run();
      toast.success('Group membership saved', `${selected.size} team${selected.size === 1 ? '' : 's'} in this group.`);
      onClose();
    } catch (cause) {
      toast.error('Could not save membership', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  const toggle = (teamId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  return (
    <Modal
      open={Boolean(group)}
      onClose={onClose}
      title={group ? `Teams in ${group.groupName}` : 'Teams'}
      description={group ? `${group.subGroupName} · pick every team that plays in this group` : undefined}
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={save.saving}>
            Cancel
          </Button>
          <Button variant="solar" size="sm" onClick={() => void submit()} loading={save.saving}>
            Save membership
          </Button>
        </>
      }
    >
      {save.error && (
        <div className="mb-4">
          <ErrorPanel message={save.error.message} />
        </div>
      )}

      {teamsLoading || membership.loading ? (
        <div className="flex items-center justify-center gap-3 py-10 text-fg/62">
          <Spinner size={16} />
          <span className="text-[13.5px]">Loading teams…</span>
        </div>
      ) : teams.length === 0 ? (
        <p className="py-8 text-center text-[13.5px] text-fg/62">
          No active teams exist in this sub-group yet. Create teams first.
        </p>
      ) : (
        <Field label={`${selected.size} of ${teams.length} selected`}>
          <ul className="space-y-1.5">
            {teams.map((team) => {
              const checked = selected.has(team.teamId);
              return (
                <li key={team.teamId}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(team.teamId)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      checked ? 'border-azure-400/70 bg-azure-500/10' : 'border-fg/16 hover:border-fg/28'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[11px] ${
                        checked ? 'border-azure-300 bg-azure-400 text-ink-900' : 'border-fg/28'
                      }`}
                    >
                      {checked ? '✓' : ''}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-sm border border-fg/26"
                      style={{ background: team.colorHex ?? 'transparent' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-fg/92">{team.teamName}</span>
                    <span className="font-mono text-[12px] text-fg/58">{team.teamCode}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Field>
      )}
    </Modal>
  );
}
