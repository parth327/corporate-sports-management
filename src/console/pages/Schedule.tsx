import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { api, ApiError, type ScheduleMaster } from '@/api';
import { SCHEDULE_STATUSES } from '@/api/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDebounced, useList, useMutation, useOptions, usePaging } from '@/hooks/useResource';
import { DataTable, Pagination, Toolbar, type Column } from '@/ui/DataTable';
import { ConfirmDialog, Modal } from '@/ui/Modal';
import {
  Badge,
  Button,
  ChipMulti,
  ErrorPanel,
  Field,
  Input,
  PageHeader,
  Select,
  StatusPill,
} from '@/ui/primitives';

/**
 * Form 22 — ScheduleMaster.
 *
 * Hand-written rather than declared, because a fixture is the one record with
 * cross-field rules: the two sides must differ and share a sub-group, and
 * neither the teams nor the officials may already be booked in the same slot.
 * The server owns those checks; this screen maps their responses back onto the
 * field that caused them.
 */

interface FixtureValues {
  matchNo: string;
  matchDate: string;
  matchTime: string;
  subGroupId: string;
  team1Id: string;
  team2Id: string;
  oversPerInnings: string;
  venue: string;
  status: string;
  eventId: string;
}

const EMPTY: FixtureValues = {
  matchNo: '',
  matchDate: '',
  matchTime: '',
  subGroupId: '',
  team1Id: '',
  team2Id: '',
  oversPerInnings: '',
  venue: '',
  status: 'Scheduled',
  eventId: '',
};

export default function SchedulePage() {
  const { scope, can } = useAuth();
  const toast = useToast();
  const paging = usePaging();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [eventId, setEventId] = useState('');
  const [editing, setEditing] = useState<ScheduleMaster | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState<ScheduleMaster | null>(null);

  const debouncedSearch = useDebounced(search);
  const { options: eventOptions } = useOptions(api.events, { isActive: true });

  const fixtures = useList(api.schedules, {
    ...(scope.subGroupId ? { subGroupId: scope.subGroupId } : {}),
    ...(status ? { status } : {}),
    ...(eventId ? { eventId: Number(eventId) } : {}),
    page: paging.page,
    pageSize: paging.pageSize,
    search: debouncedSearch || undefined,
    sortBy: 'matchDate',
    sortDir: 'asc',
  });

  const deactivate = useMutation(async (id: number) => api.schedules.deactivate(id));

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (fixture: ScheduleMaster) => {
    setEditing(fixture);
    setDialogOpen(true);
  };

  /* A `?edit=` in the URL opens a fixture directly — how the event hub's
     "needs confirmation" list hands off here without asking someone to find
     the row again. Fetched by id rather than found in the current page/filter,
     since the fixture that needs attention is not necessarily on page 1 of
     whatever this screen happened to be showing. */
  const [params] = useSearchParams();
  useEffect(() => {
    const editId = params.get('edit');
    if (!editId) return;
    api.schedules
      .get(Number(editId))
      .then(openEdit)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await deactivate.run(cancelling.scheduleId);
      toast.success(`${cancelling.matchNo} cancelled`, 'The fixture is kept in history.');
      setCancelling(null);
      fixtures.refresh();
    } catch (cause) {
      toast.error('Could not cancel', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  const columns: Column<ScheduleMaster>[] = [
    {
      key: 'matchNo',
      header: 'Match',
      primary: true,
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="whitespace-nowrap font-mono text-[12.5px] text-accent-solar">{r.matchNo}</span>
          <span className="font-semibold text-fg">
            {r.team1Name} <span className="font-normal text-fg/52">v</span> {r.team2Name}
          </span>
        </span>
      ),
    },
    {
      key: 'when',
      header: 'Date & time',
      render: (r) => (
        <span className="font-mono text-[12.5px]">
          {r.matchDate} · {r.matchTime}
        </span>
      ),
    },
    { key: 'subGroupName', header: 'Sub-group', render: (r) => r.subGroupName ?? '—' },
    { key: 'venue', header: 'Venue', secondary: true, render: (r) => r.venue || <span className="text-fg/45">—</span> },
    {
      key: 'overs',
      header: 'Overs',
      align: 'center',
      secondary: true,
      render: (r) => (r.oversPerInnings ? <span className="tabular-nums">{r.oversPerInnings}</span> : <span className="text-fg/45">—</span>),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.isActive ? r.status : 'Cancelled'} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Competition"
        title="Match schedule"
        description="Fixtures for the current season. A team or official already booked in a slot cannot be booked again — the save is refused with the reason."
        actions={
          can('schedule', 'create') ? (
            <Button variant="solar" size="sm" onClick={openCreate} icon={<span aria-hidden="true">＋</span>}>
              New fixture
            </Button>
          ) : null
        }
      />

      <Toolbar>
        <Field label="Search" htmlFor="sched-search" className="w-full sm:w-72">
          <Input
            id="sched-search"
            type="search"
            value={search}
            placeholder="Search match number or team…"
            onChange={(event) => {
              setSearch(event.target.value);
              paging.reset();
            }}
          />
        </Field>

        <Field label="Event" htmlFor="sched-event" className="w-full sm:w-56">
          <Select
            id="sched-event"
            value={eventId}
            placeholder="Any event"
            onChange={(changed) => {
              setEventId(changed.target.value);
              paging.reset();
            }}
          >
            {eventOptions.map((e) => (
              <option key={e.eventId} value={String(e.eventId)}>
                {e.eventCode} — {e.eventName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="sched-status" className="w-full sm:w-44">
          <Select
            id="sched-status"
            value={status}
            placeholder="Any status"
            onChange={(event) => {
              setStatus(event.target.value);
              paging.reset();
            }}
          >
            {SCHEDULE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      </Toolbar>

      <div className="glass overflow-hidden rounded-2xl">
        <DataTable
          columns={columns}
          rows={fixtures.items}
          rowKey={(r) => r.scheduleId}
          loading={fixtures.loading}
          error={fixtures.error}
          onRetry={fixtures.refresh}
          emptyTitle="No fixtures"
          emptyDescription="Create teams and competition groups first, then schedule the fixtures between them."
          actions={(row) => (
            <>
              {can('schedule', 'edit') && (
                <Button variant="subtle" size="sm" onClick={() => openEdit(row)}>
                  Edit
                </Button>
              )}
              {can('schedule', 'deactivate') && row.isActive && (
                <Button variant="danger" size="sm" onClick={() => setCancelling(row)}>
                  Cancel
                </Button>
              )}
            </>
          )}
        />
        <Pagination page={paging.page} pageSize={paging.pageSize} total={fixtures.total} onPageChange={paging.setPage} />
      </div>

      <FixtureDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fixtures.refresh}
        fixture={editing}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onCancel={() => setCancelling(null)}
        onConfirm={() => void confirmCancel()}
        loading={deactivate.saving}
        title="Cancel this fixture?"
        confirmLabel="Cancel fixture"
        message={
          <>
            <p>
              <strong className="text-fg">{cancelling?.matchNo}</strong> — {cancelling?.team1Name} v{' '}
              {cancelling?.team2Name}.
            </p>
            <p className="mt-2 text-fg/68">
              The fixture is flagged inactive rather than deleted, and the slot is freed for the teams
              and officials involved.
            </p>
          </>
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The fixture dialog
 * ------------------------------------------------------------------ */

function FixtureDialog({
  open,
  onClose,
  onSaved,
  fixture,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  fixture: ScheduleMaster | null;
}) {
  const { scope } = useAuth();
  const toast = useToast();
  const form = useForm<FixtureValues>({ defaultValues: EMPTY, mode: 'onBlur' });
  const values = form.watch();
  const [officials, setOfficials] = useState<(string | number)[]>([]);

  const { options: subGroups } = useOptions(api.subGroups, {});
  const { options: events } = useOptions(api.events, { isActive: true });

  /**
   * An event can be pinned to a group or a single sub-group. Reading that pin
   * here means the operator sees the narrowed list rather than discovering the
   * scope only when the server refuses the save.
   */
  const selectedEvent = events.find((e) => String(e.eventId) === values.eventId);
  const pinnedSubGroupId = selectedEvent?.subGroupId ? String(selectedEvent.subGroupId) : null;

  const subGroupId = scope.subGroupId
    ? String(scope.subGroupId)
    : (pinnedSubGroupId ?? values.subGroupId);

  const availableSubGroups = useMemo(
    () =>
      subGroups.filter((s) => {
        if (pinnedSubGroupId) return String(s.subGroupId) === pinnedSubGroupId;
        if (selectedEvent?.groupId) return Number(s.groupId) === Number(selectedEvent.groupId);
        return true;
      }),
    [subGroups, pinnedSubGroupId, selectedEvent?.groupId],
  );

  /* Switching to an event that does not cover the chosen sub-group has to drop
     it, or the form would submit a combination the list no longer offers. */
  useEffect(() => {
    if (scope.subGroupId || !values.subGroupId) return;
    if (!availableSubGroups.some((s) => String(s.subGroupId) === values.subGroupId)) {
      form.setValue('subGroupId', pinnedSubGroupId ?? '');
      form.setValue('team1Id', '');
      form.setValue('team2Id', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSubGroups, values.subGroupId]);

  const { options: teams } = useOptions(
    api.teams,
    { subGroupId: Number(subGroupId) || undefined },
    { enabled: Boolean(subGroupId) },
  );

  const { options: umpires } = useOptions(api.umpires, {});

  /* Officials are either scoped to this sub-group or available to all. */
  const availableOfficials = useMemo(
    () =>
      umpires.filter(
        (u) => u.subGroupId === null || u.subGroupId === undefined || String(u.subGroupId) === subGroupId,
      ),
    [umpires, subGroupId],
  );

  useEffect(() => {
    if (!open) return;

    if (fixture) {
      form.reset({
        matchNo: fixture.matchNo,
        matchDate: fixture.matchDate,
        matchTime: fixture.matchTime,
        subGroupId: String(fixture.subGroupId),
        team1Id: String(fixture.team1Id),
        team2Id: String(fixture.team2Id),
        oversPerInnings: fixture.oversPerInnings ? String(fixture.oversPerInnings) : '',
        venue: fixture.venue ?? '',
        status: fixture.status,
        eventId: String(fixture.eventId),
      });
      setOfficials(fixture.umpireIds ?? []);
    } else {
      const current = events.find((e) => e.isCurrent);
      form.reset({
        ...EMPTY,
        subGroupId: scope.subGroupId ? String(scope.subGroupId) : '',
        eventId: current ? String(current.eventId) : '',
      });
      setOfficials([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixture, events.length]);

  /* The team <option>s arrive after form.reset() has already run, and a <select>
     ignores a value it has no option for. Re-apply once they exist, or an edit
     would open with both sides blank. */
  useEffect(() => {
    if (!open || !fixture || !teams.length) return;
    form.setValue('team1Id', String(fixture.team1Id), { shouldDirty: false });
    form.setValue('team2Id', String(fixture.team2Id), { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixture, teams.length]);

  const save = useMutation(async (payload: Record<string, unknown>) =>
    fixture ? api.schedules.update(fixture.scheduleId, payload) : api.schedules.create(payload),
  );

  const submit = form.handleSubmit(async (v) => {
    const payload = {
      matchNo: v.matchNo.trim(),
      matchDate: v.matchDate,
      matchTime: v.matchTime,
      subGroupId: Number(subGroupId),
      team1Id: Number(v.team1Id),
      team2Id: Number(v.team2Id),
      oversPerInnings: v.oversPerInnings ? Number(v.oversPerInnings) : null,
      venue: v.venue.trim() || null,
      status: v.status,
      eventId: Number(v.eventId),
      umpireIds: officials.map(Number),
      isActive: true,
    };

    try {
      await save.run(payload);
      toast.success(fixture ? 'Fixture updated' : 'Fixture created', payload.matchNo);
      onSaved();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError) {
        for (const [field, message] of Object.entries(cause.fieldErrors)) {
          if (field in EMPTY) {
            form.setError(field as keyof FixtureValues, { type: 'server', message });
          }
        }
      }
    }
  });

  const errors = form.formState.errors;
  const sameTeam = values.team1Id && values.team1Id === values.team2Id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fixture ? `Edit ${fixture.matchNo}` : 'New fixture'}
      description="Both teams must belong to the same sub-group, and neither may already be playing in this slot."
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={save.saving}>
            Cancel
          </Button>
          <Button variant="solar" size="sm" onClick={() => void submit()} loading={save.saving}>
            {fixture ? 'Save fixture' : 'Create fixture'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
        className="space-y-4"
      >
        {save.error && !Object.keys(save.error.fieldErrors).length && (
          <ErrorPanel message={save.error.message} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* The event comes first because it narrows everything under it. */}
          <Field label="Event" htmlFor="eventId" required error={errors.eventId?.message}>
            <Select
              id="eventId"
              invalid={Boolean(errors.eventId)}
              placeholder="Select event"
              {...form.register('eventId', { required: 'Choose the event.' })}
            >
              {events.map((e) => (
                <option key={e.eventId} value={String(e.eventId)}>
                  {e.eventCode} — {e.eventName}
                  {e.subGroupName ? ` (${e.subGroupName})` : e.groupName ? ` (${e.groupName})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Match number" htmlFor="matchNo" required error={errors.matchNo?.message}>
            <Input
              id="matchNo"
              placeholder="M-001"
              invalid={Boolean(errors.matchNo)}
              {...form.register('matchNo', { required: 'Enter a match number.' })}
            />
          </Field>

          <Field
            label="Sub-group"
            htmlFor="subGroupId"
            required
            hint={
              scope.subGroupId
                ? 'Fixed to your sub-group'
                : pinnedSubGroupId
                  ? `Fixed by ${selectedEvent?.eventName}`
                  : selectedEvent?.groupId
                    ? `Limited to ${selectedEvent.groupName}`
                    : undefined
            }
            error={errors.subGroupId?.message}
          >
            <Select
              id="subGroupId"
              disabled={Boolean(scope.subGroupId) || Boolean(pinnedSubGroupId)}
              value={subGroupId}
              invalid={Boolean(errors.subGroupId)}
              placeholder="Select sub-group"
              onChange={(changed) => {
                form.setValue('subGroupId', changed.target.value);
                form.setValue('team1Id', '');
                form.setValue('team2Id', '');
                setOfficials([]);
              }}
            >
              {availableSubGroups.map((s) => (
                <option key={s.subGroupId} value={String(s.subGroupId)}>
                  {s.subGroupName}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Date"
            htmlFor="matchDate"
            required
            hint={selectedEvent ? `Within ${selectedEvent.startDate} — ${selectedEvent.endDate}` : undefined}
            error={errors.matchDate?.message}
          >
            <Input
              id="matchDate"
              type="date"
              min={selectedEvent?.startDate}
              max={selectedEvent?.endDate}
              invalid={Boolean(errors.matchDate)}
              {...form.register('matchDate', { required: 'Choose a date.' })}
            />
          </Field>

          <Field label="Time" htmlFor="matchTime" required error={errors.matchTime?.message}>
            <Input
              id="matchTime"
              type="time"
              invalid={Boolean(errors.matchTime)}
              {...form.register('matchTime', { required: 'Choose a start time.' })}
            />
          </Field>

          <Field label="Team 1" htmlFor="team1Id" required error={errors.team1Id?.message}>
            <Select
              id="team1Id"
              disabled={!subGroupId}
              invalid={Boolean(errors.team1Id)}
              placeholder={subGroupId ? 'Select team' : 'Choose a sub-group first'}
              {...form.register('team1Id', { required: 'Choose the first team.' })}
            >
              {teams.map((t) => (
                <option key={t.teamId} value={String(t.teamId)}>
                  {t.teamName}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Team 2"
            htmlFor="team2Id"
            required
            error={errors.team2Id?.message ?? (sameTeam ? 'A team cannot play itself.' : undefined)}
          >
            <Select
              id="team2Id"
              disabled={!subGroupId}
              invalid={Boolean(errors.team2Id) || Boolean(sameTeam)}
              placeholder={subGroupId ? 'Select team' : 'Choose a sub-group first'}
              {...form.register('team2Id', {
                required: 'Choose the second team.',
                validate: (value) => value !== form.getValues('team1Id') || 'A team cannot play itself.',
              })}
            >
              {teams.map((t) => (
                <option key={t.teamId} value={String(t.teamId)}>
                  {t.teamName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Overs per innings" htmlFor="oversPerInnings" hint="Leave empty for football" error={errors.oversPerInnings?.message}>
            <Input
              id="oversPerInnings"
              type="number"
              min={1}
              max={50}
              placeholder="12"
              invalid={Boolean(errors.oversPerInnings)}
              {...form.register('oversPerInnings')}
            />
          </Field>

          <Field label="Venue" htmlFor="venue">
            <Input id="venue" placeholder="Ground A" {...form.register('venue')} />
          </Field>

          <Field label="Status" htmlFor="status" required>
            <Select id="status" {...form.register('status', { required: true })}>
              {SCHEDULE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

        </div>

        <Field
          label="Officials"
          hint="An official already booked in this slot will be refused"
          error={(errors as Record<string, { message?: string }>).umpireIds?.message}
        >
          <ChipMulti
            options={availableOfficials.map((u) => ({
              value: u.umpireId,
              label: u.umpireName,
            }))}
            value={officials}
            onChange={setOfficials}
            emptyLabel={subGroupId ? 'No officials available for this sub-group.' : 'Choose a sub-group first.'}
          />
        </Field>

        {officials.length > 0 && (
          <p className="text-[12.5px] text-fg/62">
            <Badge tone="info" glyph="⚖">
              {officials.length} assigned
            </Badge>
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Modal>
  );
}
