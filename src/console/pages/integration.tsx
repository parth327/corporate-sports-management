import { useMemo, useState } from 'react';
import {
  api,
  ApiError,
  type GroupMaster,
  type PlayerMaster,
  type PlayerSubTypeDetail,
  type PlayerSubTypeMaster,
  type SubGroupMaster,
} from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDebounced, useList, useOptions, usePaging } from '@/hooks/useResource';
import { Pagination } from '@/ui/DataTable';
import { Field, PageHeader, Select } from '@/ui/primitives';
import { AssignmentBoard } from '../AssignmentBoard';
import { ClassifyBoard, type Bucket, type ZoneId } from '../ClassifyBoard';

/**
 * Steps 1 and 2 of the classification pipeline.
 *
 * Group first, then sub-group, because the server clears the level below
 * whichever one you write — a participant moved out of Sports cannot keep the
 * Cricket sub-group it held there. The two screens stay separate rather than
 * becoming one combined picker: they are used at different moments by
 * different people, and merging them would invite setting a group and a
 * sub-group in a single gesture, which the cascade makes meaningless.
 */

type Skipped = { playerId: number; name: string; reason: string }[];

/* ------------------------------------------------------------------ *
 * Participant -> Group
 * ------------------------------------------------------------------ */

export function GroupAssignmentPage() {
  const { can } = useAuth();
  const toast = useToast();
  const paging = usePaging(15);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [skipped, setSkipped] = useState<Skipped>([]);
  const [pending, setPending] = useState<number | null>(null);

  const debouncedSearch = useDebounced(search);
  const canEdit = can('integration', 'edit');

  /* No sub-group scope here, deliberately. Group sits ABOVE sub-group, so
     filtering by the signed-in user's sub-group would hide exactly the
     unclassified people this screen exists to place. */
  const list = useList(api.players, {
    page: paging.page,
    pageSize: paging.pageSize,
    search: debouncedSearch || undefined,
    isActive: true,
    ...(groupFilter ? { interest: groupFilter } : {}),
    sortBy: 'name',
    sortDir: 'asc',
  });

  const { options: groups } = useOptions<GroupMaster>(api.groups, {});

  const assign = async (groupId: number, ids: number[]) => {
    setPending(groupId);
    try {
      const result = await api.classifyParticipants({ playerIds: ids, groupId });
      const name = groups.find((g) => g.groupId === groupId)?.groupName ?? 'that group';
      setSkipped(result.skipped);

      if (result.updated) {
        toast.success(
          `${result.updated} participant${result.updated === 1 ? '' : 's'} moved to ${name}`,
          result.skipped.length ? `${result.skipped.length} could not be moved.` : undefined,
        );
      } else {
        toast.error('Nothing was moved', 'Every selected row was refused.');
      }
      list.refresh();
    } catch (cause) {
      toast.error('Could not assign', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Classification · step 1"
        title="Group assignment"
        description="Put participants into Sports, Cultural or None. Changing a group clears the sub-group and type underneath it, so start here and work down."
      />

      <AssignmentBoard
        participants={list.items}
        total={list.total}
        loading={list.loading}
        error={list.error}
        onRetry={list.refresh}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          paging.reset();
        }}
        currentOf={(row) => row.interest || null}
        detailOf={(row) => row.department || row.email}
        targets={groups.map((g) => ({ id: g.groupId, label: g.groupName, hint: g.description }))}
        onAssign={assign}
        pending={pending}
        canEdit={canEdit}
        skipped={skipped}
        onDismissSkipped={() => setSkipped([])}
        emptyTitle="No participants match"
        emptyBody="Try a different search, or clear the group filter."
        filters={
          <Field label="Current group" htmlFor="group-filter" className="w-full sm:w-56">
            <Select
              id="group-filter"
              value={groupFilter}
              placeholder="Any group"
              onChange={(event) => {
                setGroupFilter(event.target.value);
                paging.reset();
              }}
            >
              {groups.map((group) => (
                <option key={group.groupId} value={group.groupName}>
                  {group.groupName}
                </option>
              ))}
            </Select>
          </Field>
        }
      />

      <div className="mt-4">
        <Pagination
          page={paging.page}
          pageSize={paging.pageSize}
          total={list.total}
          onPageChange={paging.setPage}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Participant -> Sub-group
 * ------------------------------------------------------------------ */

export function SubGroupAssignmentPage() {
  const { can, scope } = useAuth();
  const toast = useToast();
  const paging = usePaging(15);

  const [groupId, setGroupId] = useState('');
  const [search, setSearch] = useState('');
  const [skipped, setSkipped] = useState<Skipped>([]);
  const [pending, setPending] = useState<number | null>(null);

  const debouncedSearch = useDebounced(search);
  const canEdit = can('integration', 'edit');

  const { options: groups } = useOptions<GroupMaster>(api.groups, {});
  const selectedGroup = groups.find((g) => String(g.groupId) === groupId);

  const { options: subGroups } = useOptions<SubGroupMaster>(
    api.subGroups,
    { groupId: selectedGroup?.groupId },
    { enabled: Boolean(selectedGroup) },
  );

  /* Pinned to the chosen group's participants: the server refuses a sub-group
     belonging to a different group, so offering those rows would only produce
     selections guaranteed to be rejected. */
  const list = useList(
    api.players,
    {
      page: paging.page,
      pageSize: paging.pageSize,
      search: debouncedSearch || undefined,
      isActive: true,
      interest: selectedGroup?.groupName,
      sortBy: 'name',
      sortDir: 'asc',
    },
    { enabled: Boolean(selectedGroup) },
  );

  /* A sub-group-scoped user may only file people into their own sub-group;
     offering the rest would produce a call the server rejects. */
  const offered = scope.subGroupId
    ? subGroups.filter((s) => s.subGroupId === scope.subGroupId)
    : subGroups;

  const assign = async (subGroupId: number, ids: number[]) => {
    setPending(subGroupId);
    try {
      const result = await api.classifyParticipants({ playerIds: ids, subGroupId });
      const name =
        subGroups.find((s) => s.subGroupId === subGroupId)?.subGroupName ?? 'that sub-group';
      setSkipped(result.skipped);

      if (result.updated) {
        toast.success(
          `${result.updated} participant${result.updated === 1 ? '' : 's'} moved to ${name}`,
          result.skipped.length ? `${result.skipped.length} could not be moved.` : undefined,
        );
      } else {
        toast.error('Nothing was moved', 'Every selected row was refused.');
      }
      list.refresh();
    } catch (cause) {
      toast.error('Could not assign', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Classification · step 2"
        title="Sub-group assignment"
        description="Cricket, Football or Cultural, within a group. Pick the group first — a participant can only join a sub-group of the group it already sits in."
      />

      <AssignmentBoard
        participants={selectedGroup ? list.items : []}
        total={selectedGroup ? list.total : 0}
        loading={Boolean(selectedGroup) && list.loading}
        error={list.error}
        onRetry={list.refresh}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          paging.reset();
        }}
        currentOf={(row) => row.subGroupName || null}
        detailOf={(row) => row.department || row.email}
        targets={offered.map((s) => ({ id: s.subGroupId, label: s.subGroupName }))}
        onAssign={assign}
        pending={pending}
        canEdit={canEdit && Boolean(selectedGroup)}
        skipped={skipped}
        onDismissSkipped={() => setSkipped([])}
        emptyTitle={selectedGroup ? 'No participants in this group' : 'Choose a group first'}
        emptyBody={
          selectedGroup
            ? 'Assign participants to this group on the previous screen, then come back.'
            : 'Sub-groups belong to a group, so pick one above to see who is eligible.'
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Group" htmlFor="subgroup-group" required className="w-full sm:w-56">
              <Select
                id="subgroup-group"
                value={groupId}
                placeholder="Choose a group"
                onChange={(event) => {
                  setGroupId(event.target.value);
                  paging.reset();
                }}
              >
                {groups.map((group) => (
                  <option key={group.groupId} value={group.groupId}>
                    {group.groupName}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedGroup && offered.length === 0 && (
              <p className="pb-2.5 text-[13px] text-fg/62">
                No sub-groups are configured under {selectedGroup.groupName} yet.
              </p>
            )}
          </div>
        }
      />

      {selectedGroup && (
        <div className="mt-4">
          <Pagination
            page={paging.page}
            pageSize={paging.pageSize}
            total={list.total}
            onPageChange={paging.setPage}
          />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Shared plumbing for the two drag screens
 * ------------------------------------------------------------------ */

/**
 * Both drag screens pull every participant in scope in one go and partition them
 * client-side, rather than issuing a query per bucket. A sub-group is a few
 * hundred people at most, and holding the whole set locally is what lets a
 * card land in its new column the instant it is dropped instead of after a
 * round trip.
 */
function usePopulation(query: Record<string, unknown>, enabled: boolean) {
  const list = useList<PlayerMaster>(
    api.players,
    { ...query, isActive: true, pageSize: 500, sortBy: 'name', sortDir: 'asc' },
    { enabled },
  );
  return list;
}

function matches(row: PlayerMaster, term: string) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return (
    row.name.toLowerCase().includes(needle) ||
    (row.email ?? '').toLowerCase().includes(needle) ||
    (row.department ?? '').toLowerCase().includes(needle)
  );
}

/* ------------------------------------------------------------------ *
 * Participant -> Type   (step 3, drag and drop)
 * ------------------------------------------------------------------ */

export function TypeAssignmentPage() {
  const { can, scope } = useAuth();
  const toast = useToast();

  const [subGroupId, setSubGroupId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const canEdit = can('integration', 'edit');

  const { options: subGroups } = useOptions<SubGroupMaster>(api.subGroups, {});
  const offeredSubGroups = scope.subGroupId
    ? subGroups.filter((s) => s.subGroupId === scope.subGroupId)
    : subGroups;

  const chosen = subGroups.find((s) => String(s.subGroupId) === subGroupId);

  const { options: types } = useOptions<PlayerSubTypeMaster>(
    api.playerSubTypes,
    { subGroupId: chosen?.subGroupId },
    { enabled: Boolean(chosen) },
  );

  const population = usePopulation({ subGroupId: chosen?.subGroupId }, Boolean(chosen));

  const { source, buckets } = useMemo(() => {
    const rows = population.items;
    const unassigned = rows.filter((r) => !r.playerSubTypeId && matches(r, search));
    const byType: Bucket[] = types.map((type) => ({
      id: type.playerSubTypeId,
      label: type.subTypeName,
      members: rows.filter((r) => Number(r.playerSubTypeId) === type.playerSubTypeId),
    }));
    return { source: unassigned, buckets: byType };
  }, [population.items, types, search]);

  const onMove = async (playerIds: number[], to: ZoneId) => {
    setBusy(true);
    try {
      const result = await api.classifyParticipants({ playerIds, playerSubTypeId: to });
      const name = to === null ? 'unassigned' : types.find((t) => t.playerSubTypeId === to)?.subTypeName;
      if (result.updated) {
        toast.success(
          `${result.updated} participant${result.updated === 1 ? '' : 's'} → ${name}`,
          result.skipped.length ? `${result.skipped.length} refused.` : undefined,
        );
      }
      if (result.skipped.length) {
        toast.error(
          `${result.skipped.length} could not be moved`,
          result.skipped[0]?.reason,
        );
      }
      population.refresh();
    } catch (cause) {
      toast.error('Could not classify', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Classification · step 3"
        title="Participant types"
        description="Drag a participant into the role they play — batsman, bowler, keeper, official. Changing a type clears any detail beneath it."
      />

      <div className="mb-4">
        <Field label="Sub-group" htmlFor="type-subgroup" required className="w-full sm:w-64">
          <Select
            id="type-subgroup"
            value={subGroupId}
            placeholder="Choose a sub-group"
            onChange={(event) => setSubGroupId(event.target.value)}
          >
            {offeredSubGroups.map((s) => (
              <option key={s.subGroupId} value={s.subGroupId}>
                {s.subGroupName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <ClassifyBoard
        sourceLabel="Unclassified"
        sourceHint="Everyone in this sub-group already has a type."
        source={source}
        buckets={buckets}
        onMove={onMove}
        canEdit={canEdit}
        loading={Boolean(chosen) && population.loading}
        busy={busy}
        search={search}
        onSearchChange={setSearch}
        gate={
          chosen
            ? null
            : {
                title: 'Choose a sub-group',
                body: 'Types belong to a sub-group — Cricket has batsmen and bowlers, Football has its own. Pick one above to start.',
              }
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Participant -> Type detail   (step 4, cascading drag and drop)
 * ------------------------------------------------------------------ */

export function TypeDetailAssignmentPage() {
  const { can, scope } = useAuth();
  const toast = useToast();

  const [groupId, setGroupId] = useState('');
  const [subGroupId, setSubGroupId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const canEdit = can('integration', 'edit');

  const { options: groups } = useOptions<GroupMaster>(api.groups, {});
  const group = groups.find((g) => String(g.groupId) === groupId);

  const { options: subGroups } = useOptions<SubGroupMaster>(
    api.subGroups,
    { groupId: group?.groupId },
    { enabled: Boolean(group) },
  );
  const offeredSubGroups = scope.subGroupId
    ? subGroups.filter((s) => s.subGroupId === scope.subGroupId)
    : subGroups;
  const subGroup = subGroups.find((s) => String(s.subGroupId) === subGroupId);

  const { options: types } = useOptions<PlayerSubTypeMaster>(
    api.playerSubTypes,
    { subGroupId: subGroup?.subGroupId },
    { enabled: Boolean(subGroup) },
  );
  const type = types.find((t) => String(t.playerSubTypeId) === typeId);

  const { options: details } = useOptions<PlayerSubTypeDetail>(
    api.playerSubTypeDetails,
    { playerSubTypeId: type?.playerSubTypeId },
    { enabled: Boolean(type) },
  );

  const population = usePopulation(
    { subGroupId: subGroup?.subGroupId, playerSubTypeId: type?.playerSubTypeId },
    Boolean(type),
  );

  const { source, buckets } = useMemo(() => {
    const rows = population.items;
    const unassigned = rows.filter((r) => !r.playerSubTypeDetailId && matches(r, search));
    const byDetail: Bucket[] = details.map((detail) => ({
      id: detail.playerSubTypeDetailId,
      label: detail.detailName,
      members: rows.filter(
        (r) => Number(r.playerSubTypeDetailId) === detail.playerSubTypeDetailId,
      ),
    }));
    return { source: unassigned, buckets: byDetail };
  }, [population.items, details, search]);

  /* Reset the levels below whichever one changed, so the screen can never show
     a type from a sub-group that is no longer selected. */
  const changeGroup = (value: string) => {
    setGroupId(value);
    setSubGroupId('');
    setTypeId('');
  };
  const changeSubGroup = (value: string) => {
    setSubGroupId(value);
    setTypeId('');
  };

  const onMove = async (playerIds: number[], to: ZoneId) => {
    setBusy(true);
    try {
      const result = await api.classifyParticipants({ playerIds, playerSubTypeDetailId: to });
      const name =
        to === null ? 'unassigned' : details.find((d) => d.playerSubTypeDetailId === to)?.detailName;
      if (result.updated) {
        toast.success(
          `${result.updated} participant${result.updated === 1 ? '' : 's'} → ${name}`,
          result.skipped.length ? `${result.skipped.length} refused.` : undefined,
        );
      }
      if (result.skipped.length) {
        toast.error(`${result.skipped.length} could not be moved`, result.skipped[0]?.reason);
      }
      population.refresh();
    } catch (cause) {
      toast.error('Could not classify', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const gate = !type
    ? {
        title: 'Narrow it down first',
        body: 'Detail sits under a type — pick a group, sub-group and type above, and the participants holding that type appear here.',
      }
    : details.length === 0
      ? {
          title: `${type.subTypeName} has no detail levels`,
          body: 'This type has nothing finer configured. Add detail rows in Master setup, or leave it as is — the level is optional.',
        }
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Classification · step 4 · optional"
        title="Type detail"
        description="The finest level — openers and middle order, pace and spin. Only worth filling in where the sport actually distinguishes them."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Field label="Group" htmlFor="detail-group" required className="w-full sm:w-44">
          <Select
            id="detail-group"
            value={groupId}
            placeholder="Group"
            onChange={(event) => changeGroup(event.target.value)}
          >
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.groupName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sub-group" htmlFor="detail-subgroup" required className="w-full sm:w-44">
          <Select
            id="detail-subgroup"
            value={subGroupId}
            placeholder={group ? 'Sub-group' : 'Pick a group first'}
            disabled={!group}
            onChange={(event) => changeSubGroup(event.target.value)}
          >
            {offeredSubGroups.map((s) => (
              <option key={s.subGroupId} value={s.subGroupId}>
                {s.subGroupName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Participant type" htmlFor="detail-type" required className="w-full sm:w-52">
          <Select
            id="detail-type"
            value={typeId}
            placeholder={subGroup ? 'Type' : 'Pick a sub-group first'}
            disabled={!subGroup}
            onChange={(event) => setTypeId(event.target.value)}
          >
            {types.map((t) => (
              <option key={t.playerSubTypeId} value={t.playerSubTypeId}>
                {t.subTypeName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <ClassifyBoard
        sourceLabel={type ? `${type.subTypeName} — no detail` : 'Unclassified'}
        sourceHint="Everyone holding this type already has a detail."
        source={source}
        buckets={buckets}
        onMove={onMove}
        canEdit={canEdit}
        loading={Boolean(type) && population.loading}
        busy={busy}
        search={search}
        onSearchChange={setSearch}
        gate={gate}
      />
    </>
  );
}
