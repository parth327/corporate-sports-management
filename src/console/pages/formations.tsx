import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  api,
  ApiError,
  type PlayerSubTypeMaster,
  type SubGroupMaster,
  type TeamFormation,
  type TeamFormationSlot,
} from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDebounced, useList, useMutation, useOptions, usePaging } from '@/hooks/useResource';
import { DataTable, Pagination, Toolbar, type Column } from '@/ui/DataTable';
import { ConfirmDialog, Modal } from '@/ui/Modal';
import { Badge, Button, ErrorPanel, Field, Input, PageHeader, Select } from '@/ui/primitives';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * Team formation — the shape every squad in a sub-group is built to.
 *
 * This is the one master screen that cannot be declared with CrudScreen: the
 * per-type rows are not a fixed field list, they are whatever participant types
 * the chosen sub-group happens to have. Cricket gets batsmen and bowlers,
 * Football gets defenders and forwards, and a sub-group with no types
 * configured gets none at all.
 *
 * The totals under the slot table are the point of the screen. A formation
 * whose per-type minimums already exceed the squad ceiling can never be
 * satisfied, and showing that arithmetic while it is being typed is far
 * kinder than refusing the save afterwards — though the server refuses it
 * too, because this screen is not the only thing that can write a formation.
 */

interface FormValues {
  subGroupId: string;
  formationCode: string;
  formationName: string;
  minPlayers: string;
  maxPlayers: string;
  slots: Record<number, { min: string; max: string }>;
}

const EMPTY: FormValues = {
  subGroupId: '',
  formationCode: '',
  formationName: '',
  minPlayers: '11',
  maxPlayers: '12',
  slots: {},
};

const num = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function FormationsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const paging = usePaging();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TeamFormation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retiring, setRetiring] = useState<TeamFormation | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);

  const debouncedSearch = useDebounced(search);
  const canCreate = can('formations', 'create');
  const canEdit = can('formations', 'edit');
  const canRetire = can('formations', 'deactivate');

  const list = useList<TeamFormation>(api.formations, {
    page: paging.page,
    pageSize: paging.pageSize,
    search: debouncedSearch || undefined,
    sortBy: 'formationCode',
    sortDir: 'asc',
  });

  const { options: subGroups } = useOptions<SubGroupMaster>(api.subGroups, {});

  /* The slot rows follow the sub-group chosen in the form, not the one on the
     record being edited — changing it mid-edit has to re-draw them. */
  const { options: types } = useOptions<PlayerSubTypeMaster>(
    api.playerSubTypes,
    { subGroupId: Number(values.subGroupId) || undefined },
    { enabled: Boolean(values.subGroupId) },
  );

  const save = useMutation(async (payload: Partial<TeamFormation>) =>
    editing ? api.formations.update(editing.formationId, payload) : api.formations.create(payload),
  );
  const retire = useMutation(async (id: number) => api.formations.deactivate(id));

  const openCreate = () => {
    setEditing(null);
    setValues(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (formation: TeamFormation) => {
    setEditing(formation);
    setValues({
      subGroupId: String(formation.subGroupId),
      formationCode: formation.formationCode,
      formationName: formation.formationName,
      minPlayers: String(formation.minPlayers),
      maxPlayers: String(formation.maxPlayers),
      slots: Object.fromEntries(
        (formation.slots ?? []).map((s) => [
          s.playerSubTypeId,
          { min: String(s.min), max: String(s.max) },
        ]),
      ),
    });
    setDialogOpen(true);
  };

  /* A type with no row yet defaults to 0..0 so the arithmetic below always has
     a number to add, and an untouched type contributes nothing. */
  const slotOf = (typeId: number) => values.slots[typeId] ?? { min: '0', max: '0' };

  const setSlot = (typeId: number, key: 'min' | 'max', value: string) =>
    setValues((current) => ({
      ...current,
      slots: { ...current.slots, [typeId]: { ...slotOf(typeId), [key]: value } },
    }));

  const totals = useMemo(() => {
    let floor = 0;
    let ceiling = 0;
    for (const type of types) {
      const slot = values.slots[type.playerSubTypeId];
      if (!slot) continue;
      floor += num(slot.min);
      ceiling += num(slot.max);
    }
    return { floor, ceiling };
  }, [types, values.slots]);

  const squadMin = num(values.minPlayers);
  const squadMax = num(values.maxPlayers);

  /* Mirrors the server's rules so the problem is visible while typing. */
  const problem =
    squadMax < squadMin
      ? 'Squad maximum is below the minimum.'
      : totals.floor > squadMax
        ? `Per-type minimums add up to ${totals.floor}, above the squad maximum of ${squadMax}.`
        : totals.ceiling > 0 && totals.ceiling < squadMin
          ? `Per-type maximums only reach ${totals.ceiling}, below the squad minimum of ${squadMin}.`
          : null;

  const submit = async () => {
    const slots: TeamFormationSlot[] = types
      .map((type) => ({
        playerSubTypeId: type.playerSubTypeId,
        min: num(slotOf(type.playerSubTypeId).min),
        max: num(slotOf(type.playerSubTypeId).max),
      }))
      /* A type left at 0..0 is simply not part of this formation. */
      .filter((slot) => slot.max > 0 || slot.min > 0);

    try {
      await save.run({
        subGroupId: Number(values.subGroupId),
        formationCode: values.formationCode.trim(),
        formationName: values.formationName.trim(),
        minPlayers: squadMin,
        maxPlayers: squadMax,
        slots,
      });
      toast.success(
        editing ? `${values.formationName} updated` : `${values.formationName} created`,
      );
      setDialogOpen(false);
      list.refresh();
    } catch (cause) {
      if (!(cause instanceof ApiError)) {
        toast.error('Could not save the formation');
      }
    }
  };

  const confirmRetire = async () => {
    if (!retiring) return;
    try {
      await retire.run(retiring.formationId);
      toast.success(`${retiring.formationName} retired`, 'Existing teams keep their shape.');
      setRetiring(null);
      list.refresh();
    } catch (cause) {
      toast.error('Could not retire', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  const columns: Column<TeamFormation>[] = [
    {
      key: 'formationCode',
      header: 'Formation',
      primary: true,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold text-fg">{r.formationName}</span>
          <span className="font-mono text-[12px] text-fg/58">{r.formationCode}</span>
        </span>
      ),
    },
    { key: 'subGroupName', header: 'Sub-group', render: (r) => r.subGroupName ?? '—' },
    {
      key: 'size',
      header: 'Squad',
      align: 'center',
      render: (r) => (
        <span className="tabular-nums text-fg/86">
          {r.minPlayers}–{r.maxPlayers}
        </span>
      ),
    },
    {
      key: 'slots',
      header: 'Composition',
      render: (r) => (
        <span className="flex flex-wrap gap-1.5">
          {(r.slots ?? []).map((slot) => (
            <Badge key={slot.playerSubTypeId} tone="neutral" glyph="◆">
              {slot.playerSubTypeName ?? `#${slot.playerSubTypeId}`} {slot.min}–{slot.max}
            </Badge>
          ))}
          {(r.slots ?? []).length === 0 && <span className="text-fg/45">No per-type limits</span>}
        </span>
      ),
    },
    {
      key: 'teamCount',
      header: 'Teams',
      align: 'center',
      secondary: true,
      render: (r) => <span className="tabular-nums text-fg/86">{r.teamCount ?? 0}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Competition"
        title="Team formation"
        description="How many participants a squad runs, and how many of each type. Every team in a sub-group is built against one of these."
        actions={
          canCreate ? (
            <Button variant="solar" size="sm" onClick={openCreate} icon={<span aria-hidden="true">＋</span>}>
              New formation
            </Button>
          ) : null
        }
      />

      <Toolbar>
        <Field label="Search" htmlFor="formation-search" className="w-full sm:w-72">
          <Input
            id="formation-search"
            type="search"
            value={search}
            placeholder="Search code or name…"
            onChange={(event) => {
              setSearch(event.target.value);
              paging.reset();
            }}
          />
        </Field>
      </Toolbar>

      <DataTable
        rows={list.items}
        columns={columns}
        rowKey={(r) => r.formationId}
        loading={list.loading}
        error={list.error}
        onRetry={list.refresh}
        emptyTitle="No formations yet"
        emptyDescription="Create one so squads have a shape to be built against."
        onRowClick={canEdit ? openEdit : undefined}
        actions={(row) =>
          canRetire && row.isActive ? (
            <Button
              variant="danger"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setRetiring(row);
              }}
            >
              Retire
            </Button>
          ) : null
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

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? `Edit ${editing.formationName}` : 'New formation'}
        description="Set the squad size, then how many of each participant type it may hold."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="solar"
              loading={save.saving}
              disabled={Boolean(problem) || !values.subGroupId || !values.formationName.trim()}
              onClick={() => void submit()}
            >
              {editing ? 'Save changes' : 'Create formation'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {save.error && !Object.keys(save.error.fieldErrors).length && (
            <ErrorPanel message={save.error.message} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Sub-group"
              htmlFor="formation-subgroup"
              required
              error={save.error?.fieldErrors.subGroupId}
              hint={editing ? 'Changing this re-draws the type rows' : undefined}
            >
              <Select
                id="formation-subgroup"
                value={values.subGroupId}
                placeholder="Choose a sub-group"
                onChange={(event) =>
                  setValues((c) => ({ ...c, subGroupId: event.target.value, slots: {} }))
                }
              >
                {subGroups.map((s) => (
                  <option key={s.subGroupId} value={s.subGroupId}>
                    {s.subGroupName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Formation code"
              htmlFor="formation-code"
              required
              error={save.error?.fieldErrors.formationCode}
              hint="Short and unique, e.g. CRK-XI"
            >
              <Input
                id="formation-code"
                value={values.formationCode}
                maxLength={20}
                onChange={(event) =>
                  setValues((c) => ({ ...c, formationCode: event.target.value.toUpperCase() }))
                }
                invalid={Boolean(save.error?.fieldErrors.formationCode)}
              />
            </Field>

            <Field label="Formation name" htmlFor="formation-name" required className="sm:col-span-2">
              <Input
                id="formation-name"
                value={values.formationName}
                maxLength={80}
                placeholder="Standard XI"
                onChange={(event) => setValues((c) => ({ ...c, formationName: event.target.value }))}
              />
            </Field>

            <Field
              label="Minimum participants"
              htmlFor="formation-min"
              required
              error={save.error?.fieldErrors.minPlayers}
              hint="A squad below this is short"
            >
              <Input
                id="formation-min"
                type="number"
                min={1}
                value={values.minPlayers}
                onChange={(event) => setValues((c) => ({ ...c, minPlayers: event.target.value }))}
                invalid={Boolean(save.error?.fieldErrors.minPlayers)}
              />
            </Field>

            <Field
              label="Maximum participants"
              htmlFor="formation-max"
              required
              error={save.error?.fieldErrors.maxPlayers}
              hint="Allocation is blocked past this"
            >
              <Input
                id="formation-max"
                type="number"
                min={1}
                value={values.maxPlayers}
                onChange={(event) => setValues((c) => ({ ...c, maxPlayers: event.target.value }))}
                invalid={Boolean(save.error?.fieldErrors.maxPlayers)}
              />
            </Field>
          </div>

          {/* Per-type composition */}
          <div>
            <h3 className="mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-fg/72">
              Composition by participant type
            </h3>
            <p className="mb-3 text-[12.5px] leading-relaxed text-fg/62">
              Leave a type at zero to keep it out of this formation entirely.
            </p>

            {!values.subGroupId ? (
              <p className="rounded-lg border border-dashed border-fg/16 px-3 py-6 text-center text-[12.5px] text-fg/45">
                Choose a sub-group to see its participant types.
              </p>
            ) : types.length === 0 ? (
              <p className="rounded-lg border border-dashed border-fg/16 px-3 py-6 text-center text-[12.5px] text-fg/45">
                This sub-group has no participant types configured yet. Add them in Master setup.
              </p>
            ) : (
              <ul className="divide-y divide-fg/10 overflow-hidden rounded-xl border border-fg/14">
                {types.map((type) => {
                  const slot = slotOf(type.playerSubTypeId);
                  const active = num(slot.max) > 0 || num(slot.min) > 0;
                  return (
                    <li
                      key={type.playerSubTypeId}
                      className={`flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors ${
                        active ? 'bg-fg/[0.04]' : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                        {type.subTypeName}
                      </span>
                      <label className="flex items-center gap-1.5 text-[12px] text-fg/62">
                        Min
                        <input
                          type="number"
                          min={0}
                          value={slot.min}
                          onChange={(event) =>
                            setSlot(type.playerSubTypeId, 'min', event.target.value)
                          }
                          className="w-16 rounded-md border border-fg/18 bg-surface/60 px-2 py-1 text-[13px] text-fg outline-none focus:border-azure-400"
                          aria-label={`Minimum ${type.subTypeName}`}
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[12px] text-fg/62">
                        Max
                        <input
                          type="number"
                          min={0}
                          value={slot.max}
                          onChange={(event) =>
                            setSlot(type.playerSubTypeId, 'max', event.target.value)
                          }
                          className="w-16 rounded-md border border-fg/18 bg-surface/60 px-2 py-1 text-[13px] text-fg outline-none focus:border-azure-400"
                          aria-label={`Maximum ${type.subTypeName}`}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* The arithmetic, live. */}
            {values.subGroupId && types.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE.smooth }}
                className={`mt-3 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed ${
                  problem
                    ? 'border-magenta-500/50 bg-magenta-500/[0.08] text-fg/88'
                    : 'border-phthalo-500/40 bg-phthalo-500/[0.08] text-fg/80'
                }`}
              >
                {problem ? (
                  <>
                    <strong className="text-accent-magenta">Impossible shape.</strong> {problem}
                  </>
                ) : (
                  <>
                    Per-type totals reach{' '}
                    <strong className="text-fg">
                      {totals.floor}–{totals.ceiling}
                    </strong>{' '}
                    against a squad of{' '}
                    <strong className="text-fg">
                      {squadMin}–{squadMax}
                    </strong>
                    . A squad can be filled.
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(retiring)}
        onCancel={() => setRetiring(null)}
        onConfirm={() => void confirmRetire()}
        title={`Retire ${retiring?.formationName ?? ''}?`}
        message={
          <>
            The formation is kept in history and teams already built against it keep their shape.
            It simply stops being offered for new teams.
            {(retiring?.teamCount ?? 0) > 0 && (
              <strong className="mt-2 block text-fg">
                {retiring?.teamCount} team{retiring?.teamCount === 1 ? '' : 's'} currently use it.
              </strong>
            )}
          </>
        }
        confirmLabel="Retire formation"
        loading={retire.saving}
      />
    </>
  );
}
