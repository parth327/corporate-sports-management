import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  api,
  ApiError,
  type MatchResult,
  type ScheduleMaster,
  type TeamAllocation,
} from '@/api';
import { RESULT_METHODS, TOSS_DECISIONS, type ResultMethod } from '@/api/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDebounced, useList, useMutation, useOptions, usePaging, useRecord } from '@/hooks/useResource';
import { DataTable, Pagination, Toolbar, type Column } from '@/ui/DataTable';
import {
  Badge,
  Button,
  Card,
  ChipGroup,
  ErrorPanel,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '@/ui/primitives';
import { SportBanner } from '../SportBanner';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * Form 23 — results and winners.
 *
 * The screen is built around one flow: pick a match, have its details fetched
 * for you, then declare who won. Everything the scorer would otherwise retype
 * — the two sides, the date, the venue, the officials, the squads the awards
 * come from — is read from the fixture rather than entered again.
 *
 * The winner is *chosen*, not inferred from the scores. A match can be decided
 * on a walkover, a super over or a penalty shoot-out, where the printed score
 * does not settle it; deriving the winner silently would produce a confident
 * wrong answer in exactly those cases. The scores still drive a suggested
 * outcome, which is offered and can be accepted with one press.
 *
 * A draw is `Tie` with no winning team and equal points — that pair is how
 * "both sides win" is recorded, rather than a second winner column that would
 * be empty on every other row.
 */

/* ------------------------------------------------------------------ *
 * Form shape
 * ------------------------------------------------------------------ */

/** Which side took it. Kept apart from the wire shape because "draw" is a
 *  choice the scorer makes, while `result` + `winningTeamId` is how it stores. */
type Outcome = 'team1' | 'team2' | 'draw' | 'none';

interface ResultValues {
  team1Score: string;
  team1Wickets: string;
  team2Score: string;
  team2Wickets: string;
  oversBowled: string;
  resultMethod: string;
  margin: string;
  pointsTeam1: string;
  pointsTeam2: string;
  tossWonByTeamId: string;
  tossDecision: string;
  manOfTheMatchPlayerId: string;
  bestBatsmanPlayerId: string;
  bestBowlerPlayerId: string;
  remarks: string;
}

const EMPTY: ResultValues = {
  team1Score: '',
  team1Wickets: '',
  team2Score: '',
  team2Wickets: '',
  oversBowled: '',
  resultMethod: '',
  margin: '',
  pointsTeam1: '2',
  pointsTeam2: '0',
  tossWonByTeamId: '',
  tossDecision: '',
  manOfTheMatchPlayerId: '',
  bestBatsmanPlayerId: '',
  bestBowlerPlayerId: '',
  remarks: '',
};

const POINTS: Record<Outcome, [string, string]> = {
  team1: ['2', '0'],
  team2: ['0', '2'],
  draw: ['1', '1'],
  none: ['1', '1'],
};

const METHOD_LABELS: Record<ResultMethod, string> = {
  Runs: 'Runs',
  Wickets: 'Wickets',
  Goals: 'Goals',
  Points: 'Points',
  Penalties: 'Penalty shoot-out',
  SuperOver: 'Super over',
  Walkover: 'Walkover',
  Forfeit: 'Forfeit',
};

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function ResultsPage() {
  const { scope, can, user } = useAuth();
  const paging = usePaging();
  const toast = useToast();
  const entryRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debouncedSearch = useDebounced(search);

  /* A `?match=` in the URL pre-selects a fixture — how the event hub's
     "awaiting result" list hands off to this screen without making someone
     find the match a second time. Read once: after that the picker owns the
     selection, so search and paging keep working normally. */
  const [params] = useSearchParams();
  useEffect(() => {
    const fromUrl = params.get('match');
    if (fromUrl) setSelectedId(Number(fromUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scopeQuery = scope.subGroupId ? { subGroupId: scope.subGroupId } : {};

  const fixtures = useList(api.schedules, {
    ...scopeQuery,
    ...(eventId ? { eventId: Number(eventId) } : {}),
    isActive: true,
    page: paging.page,
    pageSize: paging.pageSize,
    search: debouncedSearch || undefined,
    sortBy: 'matchDate',
    sortDir: 'desc',
  });

  /* The selector needs every fixture in scope, not just the current page —
     you cannot choose a match you would have to paginate to. */
  const { options: selectable } = useOptions(api.schedules, {
    ...scopeQuery,
    ...(eventId ? { eventId: Number(eventId) } : {}),
  });

  const { options: eventOptions } = useOptions(api.events, { isActive: true });

  const results = useList(api.matchResults, { pageSize: 1000 });

  const byScheduleId = useMemo(() => {
    const map = new Map<number, MatchResult>();
    for (const result of results.items) map.set(result.scheduleId, result);
    return map;
  }, [results.items]);

  const refreshAll = () => {
    fixtures.refresh();
    results.refresh();
  };

  const choose = (scheduleId: number | null) => {
    setSelectedId(scheduleId);
    if (scheduleId !== null) {
      /* Coming from a row action, the panel is above the fold the user is
         looking at — take them to it rather than leaving them wondering
         whether the button did anything. */
      window.requestAnimationFrame(() =>
        entryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
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
      key: 'matchDate',
      header: 'Played',
      render: (r) => <span className="whitespace-nowrap font-mono text-[12.5px]">{r.matchDate}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      render: (r) => {
        const result = byScheduleId.get(r.scheduleId);
        if (!result) return <span className="text-fg/45">Not entered</span>;
        const side = (score: number, wickets?: number | null) =>
          `${score}${wickets !== null && wickets !== undefined ? `/${wickets}` : ''}`;
        return (
          <span className="font-mono text-[13px] text-fg/90">
            {side(result.team1Score, result.team1Wickets)}
            <span className="text-fg/52"> — </span>
            {side(result.team2Score, result.team2Wickets)}
          </span>
        );
      },
    },
    {
      key: 'outcome',
      header: 'Winner',
      render: (r) => {
        const result = byScheduleId.get(r.scheduleId);
        if (!result)
          return (
            <Badge tone="warning" glyph="◐">
              Awaiting
            </Badge>
          );
        if (result.result === 'Tie')
          return (
            <span className="text-[13px]">
              <Badge tone="info" glyph="=">
                Draw — both share
              </Badge>
            </span>
          );
        if (result.result === 'NoResult')
          return (
            <Badge tone="neutral" glyph="○">
              No result
            </Badge>
          );
        return (
          <span className="text-[13px]">
            <Badge tone="success" glyph="★">
              {result.winningTeamName ??
                (result.winningTeamId === r.team1Id ? r.team1Name : r.team2Name)}
            </Badge>
            {result.margin && <span className="ml-2 text-fg/62">{result.margin}</span>}
          </span>
        );
      },
    },
    {
      key: 'award',
      header: 'Player of the match',
      secondary: true,
      render: (r) => {
        const result = byScheduleId.get(r.scheduleId);
        return result?.manOfTheMatchName ? (
          <span className="text-[13px] text-fg/88">{result.manOfTheMatchName}</span>
        ) : (
          <span className="text-fg/45">—</span>
        );
      },
    },
  ];

  const entered = fixtures.items.filter((f) => byScheduleId.has(f.scheduleId)).length;
  /* Only used to colour the banner — a Main Admin sees every sub-group, so the
     chosen match is the only thing that says which sport this is. */
  const selectedFixture = selectable.find((f) => f.scheduleId === selectedId);

  return (
    <>
      <SportBanner
        subGroupName={user?.subGroupName ?? selectedFixture?.subGroupName}
        eyebrow="Events"
        title="Results & winners"
        description="Choose a match and its details are fetched for you. Declare the winner, or record a draw so both sides share the points. This is what standings, the dashboard and post-event reporting read from."
        actions={
          <Badge tone="info" glyph="★">
            {byScheduleId.size} recorded
          </Badge>
        }
      />

      {/* Enough margin to clear the sticky topbar, or scrolling here from a
          row action lands the panel's heading underneath it. */}
      <div ref={entryRef} className="scroll-mt-24">
        <WinnerEntry
          fixtures={selectable}
          selectedId={selectedId}
          existing={selectedId ? (byScheduleId.get(selectedId) ?? null) : null}
          canEdit={can('results', 'edit')}
          onSelect={choose}
          onSaved={(message) => {
            toast.success('Result saved', message);
            refreshAll();
            setSelectedId(null);
          }}
        />
      </div>

      <Toolbar>
        <Field label="Search" htmlFor="result-search" className="w-full sm:w-72">
          <Input
            id="result-search"
            type="search"
            value={search}
            placeholder="Search match number or team…"
            onChange={(event) => {
              setSearch(event.target.value);
              paging.reset();
            }}
          />
        </Field>

        <Field label="Event" htmlFor="result-event" className="w-full sm:w-56">
          <Select
            id="result-event"
            value={eventId}
            placeholder="Any event"
            onChange={(event) => {
              setEventId(event.target.value);
              setSelectedId(null);
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

        <span className="w-full text-[12.5px] text-fg/58 sm:ml-auto sm:w-auto sm:self-end sm:pb-2.5">
          {entered} of {fixtures.items.length} shown have a result
        </span>
      </Toolbar>

      <div className="glass overflow-hidden rounded-2xl">
        <DataTable
          columns={columns}
          rows={fixtures.items}
          rowKey={(r) => r.scheduleId}
          loading={fixtures.loading}
          error={fixtures.error}
          onRetry={refreshAll}
          emptyTitle="No fixtures to score"
          emptyDescription="Schedule some fixtures first, then record their results here."
          actions={(row) =>
            can('results', 'edit') ? (
              <Button
                variant={byScheduleId.has(row.scheduleId) ? 'subtle' : 'solar'}
                size="sm"
                onClick={() => choose(row.scheduleId)}
              >
                {byScheduleId.has(row.scheduleId) ? 'Edit result' : 'Enter result'}
              </Button>
            ) : null
          }
        />
        <Pagination
          page={paging.page}
          pageSize={paging.pageSize}
          total={fixtures.total}
          onPageChange={paging.setPage}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Select a match → auto-fetch → declare the winner
 * ------------------------------------------------------------------ */

function WinnerEntry({
  fixtures,
  selectedId,
  existing,
  canEdit,
  onSelect,
  onSaved,
}: {
  fixtures: ScheduleMaster[];
  selectedId: number | null;
  existing: MatchResult | null;
  canEdit: boolean;
  onSelect: (id: number | null) => void;
  onSaved: (message: string) => void;
}) {
  const form = useForm<ResultValues>({ defaultValues: EMPTY, mode: 'onBlur' });
  const values = form.watch();
  const [outcome, setOutcome] = useState<Outcome>('team1');

  /* The fixture is re-fetched by id rather than taken from the list, so the
     panel shows the officials and the live status a stale list row would not. */
  const { record: fixture, loading } = useRecord(api.schedules, selectedId);

  const squad1 = useList(
    api.teamAllocations,
    { teamId: fixture?.team1Id, isActive: true, pageSize: 100 },
    { enabled: Boolean(fixture?.team1Id) },
  );
  const squad2 = useList(
    api.teamAllocations,
    { teamId: fixture?.team2Id, isActive: true, pageSize: 100 },
    { enabled: Boolean(fixture?.team2Id) },
  );

  const { options: umpires } = useOptions(api.umpires, {});

  const officials = useMemo(
    () =>
      (fixture?.umpireIds ?? [])
        .map((id) => umpires.find((u) => u.umpireId === id)?.umpireName)
        .filter(Boolean) as string[],
    [fixture?.umpireIds, umpires],
  );

  /* Cricket gets wickets and overs; everything else does not. */
  const isCricket = Boolean(fixture?.oversPerInnings);

  useEffect(() => {
    if (!fixture) return;

    if (existing) {
      setOutcome(
        existing.result === 'Tie'
          ? 'draw'
          : existing.result === 'NoResult'
            ? 'none'
            : existing.winningTeamId === fixture.team1Id
              ? 'team1'
              : 'team2',
      );
      form.reset({
        team1Score: String(existing.team1Score),
        team1Wickets: existing.team1Wickets != null ? String(existing.team1Wickets) : '',
        team2Score: String(existing.team2Score),
        team2Wickets: existing.team2Wickets != null ? String(existing.team2Wickets) : '',
        oversBowled: existing.oversBowled != null ? String(existing.oversBowled) : '',
        resultMethod: existing.resultMethod ?? '',
        margin: existing.margin ?? '',
        pointsTeam1: String(existing.pointsTeam1),
        pointsTeam2: String(existing.pointsTeam2),
        tossWonByTeamId: existing.tossWonByTeamId ? String(existing.tossWonByTeamId) : '',
        tossDecision: existing.tossDecision ?? '',
        manOfTheMatchPlayerId: existing.manOfTheMatchPlayerId ? String(existing.manOfTheMatchPlayerId) : '',
        bestBatsmanPlayerId: existing.bestBatsmanPlayerId ? String(existing.bestBatsmanPlayerId) : '',
        bestBowlerPlayerId: existing.bestBowlerPlayerId ? String(existing.bestBowlerPlayerId) : '',
        remarks: existing.remarks ?? '',
      });
    } else {
      setOutcome('team1');
      form.reset({
        ...EMPTY,
        oversBowled: fixture.oversPerInnings ? String(fixture.oversPerInnings) : '',
        resultMethod: fixture.oversPerInnings ? 'Runs' : 'Goals',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture?.scheduleId, existing?.matchResultId]);

  /**
   * What the scores say, offered rather than imposed.
   *
   * This is the suggestion the scorer can accept in one press. It is not
   * applied automatically, because the whole point of choosing the winner is
   * that the scoreline is not always the thing that decided the match.
   */
  const suggestion = useMemo(() => {
    if (!fixture) return null;
    const s1 = Number(values.team1Score);
    const s2 = Number(values.team2Score);
    if (values.team1Score === '' || values.team2Score === '') return null;
    if (!Number.isFinite(s1) || !Number.isFinite(s2)) return null;

    const unit = isCricket ? 'runs' : Math.abs(s1 - s2) === 1 ? 'goal' : 'goals';
    if (s1 === s2) {
      return { outcome: 'draw' as Outcome, label: 'Scores level — a draw', margin: 'Scores level' };
    }
    const winner = s1 > s2 ? fixture.team1Name : fixture.team2Name;
    return {
      outcome: (s1 > s2 ? 'team1' : 'team2') as Outcome,
      label: `${winner} by ${Math.abs(s1 - s2)} ${unit}`,
      margin: `${Math.abs(s1 - s2)} ${unit}`,
    };
  }, [fixture, values.team1Score, values.team2Score, isCricket]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setOutcome(suggestion.outcome);
    form.setValue('margin', suggestion.margin);
    const [p1, p2] = POINTS[suggestion.outcome];
    form.setValue('pointsTeam1', p1);
    form.setValue('pointsTeam2', p2);
  };

  const chooseOutcome = (next: Outcome) => {
    setOutcome(next);
    const [p1, p2] = POINTS[next];
    form.setValue('pointsTeam1', p1);
    form.setValue('pointsTeam2', p2);
    if (next === 'draw') form.setValue('margin', 'Scores level');
    if (next === 'none') form.setValue('margin', '');
  };

  /* The award pickers offer both squads, labelled by side. */
  const squad = useMemo(() => {
    const label = (rows: TeamAllocation[], teamName?: string) =>
      rows.map((a) => ({ id: a.playerId, name: a.playerName ?? `#${a.playerId}`, team: teamName ?? '' }));
    return [
      ...label(squad1.items, fixture?.team1Name),
      ...label(squad2.items, fixture?.team2Name),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [squad1.items, squad2.items, fixture?.team1Name, fixture?.team2Name]);

  const save = useMutation(async (payload: Record<string, unknown>) =>
    existing ? api.matchResults.update(existing.matchResultId, payload) : api.matchResults.create(payload),
  );

  const submit = form.handleSubmit(async (v) => {
    if (!fixture) return;

    const payload = {
      scheduleId: fixture.scheduleId,
      team1Score: Number(v.team1Score),
      team1Wickets: isCricket && v.team1Wickets !== '' ? Number(v.team1Wickets) : null,
      team2Score: Number(v.team2Score),
      team2Wickets: isCricket && v.team2Wickets !== '' ? Number(v.team2Wickets) : null,
      oversBowled: v.oversBowled !== '' ? Number(v.oversBowled) : null,
      result: outcome === 'draw' ? 'Tie' : outcome === 'none' ? 'NoResult' : 'Win',
      winningTeamId:
        outcome === 'team1' ? fixture.team1Id : outcome === 'team2' ? fixture.team2Id : null,
      resultMethod: v.resultMethod || null,
      margin: v.margin.trim() || null,
      pointsTeam1: Number(v.pointsTeam1),
      pointsTeam2: Number(v.pointsTeam2),
      tossWonByTeamId: v.tossWonByTeamId ? Number(v.tossWonByTeamId) : null,
      tossDecision: v.tossDecision || null,
      manOfTheMatchPlayerId: v.manOfTheMatchPlayerId ? Number(v.manOfTheMatchPlayerId) : null,
      bestBatsmanPlayerId: v.bestBatsmanPlayerId ? Number(v.bestBatsmanPlayerId) : null,
      bestBowlerPlayerId: v.bestBowlerPlayerId ? Number(v.bestBowlerPlayerId) : null,
      remarks: v.remarks.trim() || null,
      isActive: true,
    };

    try {
      await save.run(payload);
      /* Recording a result closes the fixture. */
      await api.schedules.update(fixture.scheduleId, { status: 'Completed' });
      onSaved(
        outcome === 'draw'
          ? `${fixture.matchNo} drawn — both sides take a point.`
          : outcome === 'none'
            ? `${fixture.matchNo} recorded as no result.`
            : `${outcome === 'team1' ? fixture.team1Name : fixture.team2Name} win ${fixture.matchNo}.`,
      );
    } catch (cause) {
      if (cause instanceof ApiError) {
        for (const [field, message] of Object.entries(cause.fieldErrors)) {
          if (field in EMPTY) form.setError(field as keyof ResultValues, { type: 'server', message });
        }
      }
    }
  });

  const errors = form.formState.errors;

  const outcomeOptions = fixture
    ? [
        { value: 'team1', label: `${fixture.team1Name} win` },
        { value: 'draw', label: 'Draw — both share' },
        { value: 'team2', label: `${fixture.team2Name} win` },
        { value: 'none', label: 'No result' },
      ]
    : [];

  return (
    <section className="glass-strong mb-6 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field
          label="Select a match"
          htmlFor="result-pick"
          className="w-full sm:max-w-md"
          hint="Its details are fetched for you"
        >
          <Select
            id="result-pick"
            value={selectedId === null ? '' : String(selectedId)}
            placeholder="Choose a match…"
            onChange={(event) => onSelect(event.target.value ? Number(event.target.value) : null)}
          >
            {fixtures.map((f) => (
              <option key={f.scheduleId} value={String(f.scheduleId)}>
                {f.matchNo} — {f.team1Name} v {f.team2Name} · {f.matchDate}
              </option>
            ))}
          </Select>
        </Field>

        {selectedId !== null && (
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)} className="sm:mb-2.5">
            Clear
          </Button>
        )}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {selectedId === null ? (
          <motion.p
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="mt-4 text-[13.5px] leading-relaxed text-fg/58"
          >
            Pick a match above, or press <strong className="text-fg/80">Enter result</strong> on any
            row below. Nothing has to be retyped — the sides, the date, the venue, the officials and
            both squads come from the fixture.
          </motion.p>
        ) : loading || !fixture ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-center gap-3 text-[13.5px] text-fg/68"
          >
            <Spinner /> Fetching match details…
          </motion.div>
        ) : (
          <motion.div
            key={fixture.scheduleId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.base, ease: EASE.luxe }}
            className="mt-6 space-y-6"
          >
            <FixtureFacts fixture={fixture} officials={officials} squadSize={squad.length} />

            {!canEdit ? (
              <p className="rounded-lg border border-fg/12 bg-fg/[0.03] px-4 py-3 text-[13.5px] text-fg/68">
                You have read access to results. Ask a Main Admin for entry rights to record one.
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
                noValidate
                className="space-y-6"
              >
                {save.error && !Object.keys(save.error.fieldErrors).length && (
                  <ErrorPanel message={save.error.message} />
                )}

                {/* --- Scores --- */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {([1, 2] as const).map((side) => {
                    const name = side === 1 ? fixture.team1Name : fixture.team2Name;
                    const scoreKey = side === 1 ? 'team1Score' : 'team2Score';
                    const wicketKey = side === 1 ? 'team1Wickets' : 'team2Wickets';
                    const pointsKey = side === 1 ? 'pointsTeam1' : 'pointsTeam2';
                    return (
                      <Card key={side} title={name ?? `Team ${side}`}>
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            label={isCricket ? 'Runs' : 'Score'}
                            htmlFor={scoreKey}
                            required
                            error={errors[scoreKey]?.message}
                          >
                            <Input
                              id={scoreKey}
                              type="number"
                              min={0}
                              invalid={Boolean(errors[scoreKey])}
                              {...form.register(scoreKey, { required: 'Enter the score.' })}
                            />
                          </Field>

                          {isCricket ? (
                            <Field label="Wickets" htmlFor={wicketKey}>
                              <Input
                                id={wicketKey}
                                type="number"
                                min={0}
                                max={10}
                                {...form.register(wicketKey)}
                              />
                            </Field>
                          ) : (
                            <span aria-hidden="true" />
                          )}

                          <Field label="Points" htmlFor={pointsKey} required className="col-span-2">
                            <Input
                              id={pointsKey}
                              type="number"
                              min={0}
                              {...form.register(pointsKey, { required: true })}
                            />
                          </Field>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* --- Winner --- */}
                <div className="rounded-xl border border-solar-500/25 bg-solar-500/[0.05] p-4 sm:p-5">
                  <Field
                    label="Who won?"
                    hint="A draw gives both sides a point — neither is recorded as the winner."
                  >
                    <ChipGroup
                      name="outcome"
                      options={outcomeOptions}
                      value={outcome}
                      onChange={(value) => chooseOutcome(value as Outcome)}
                    />
                  </Field>

                  {suggestion && suggestion.outcome !== outcome && (
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-fg/72">
                      <span aria-hidden="true" className="text-accent-azure">
                        ◈
                      </span>
                      The scores say <strong className="text-fg">{suggestion.label}</strong>.
                      <button
                        type="button"
                        onClick={applySuggestion}
                        className="link text-[13px] font-semibold"
                      >
                        Use that
                      </button>
                    </p>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Decided on" htmlFor="resultMethod" hint="How the match was settled">
                      <Select
                        id="resultMethod"
                        placeholder="Not recorded"
                        {...form.register('resultMethod')}
                      >
                        {RESULT_METHODS.map((value) => (
                          <option key={value} value={value}>
                            {METHOD_LABELS[value]}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Margin" htmlFor="margin" hint="Shown on standings and exports">
                      <Input id="margin" placeholder="24 runs" {...form.register('margin')} />
                    </Field>
                  </div>
                </div>

                {/* --- Match detail --- */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Toss won by" htmlFor="tossWonByTeamId">
                    <Select id="tossWonByTeamId" placeholder="Not recorded" {...form.register('tossWonByTeamId')}>
                      <option value={String(fixture.team1Id)}>{fixture.team1Name}</option>
                      <option value={String(fixture.team2Id)}>{fixture.team2Name}</option>
                    </Select>
                  </Field>

                  <Field label="Elected to" htmlFor="tossDecision">
                    <Select id="tossDecision" placeholder="Not recorded" {...form.register('tossDecision')}>
                      {TOSS_DECISIONS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label={isCricket ? 'Overs bowled' : 'Minutes played'}
                    htmlFor="oversBowled"
                  >
                    <Input id="oversBowled" type="number" min={0} {...form.register('oversBowled')} />
                  </Field>
                </div>

                {/* --- Awards --- */}
                <div>
                  <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-fg/58">
                    Awards
                  </h3>
                  {squad.length === 0 ? (
                    <p className="text-[13.5px] text-fg/58">
                      Neither side has a squad allocated yet, so there is nobody to award. Build the
                      squads first and the pickers will fill themselves.
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Player of the match" htmlFor="manOfTheMatchPlayerId" error={errors.manOfTheMatchPlayerId?.message}>
                        <SquadSelect id="manOfTheMatchPlayerId" squad={squad} form={form} />
                      </Field>
                      {isCricket && (
                        <>
                          <Field label="Best batter" htmlFor="bestBatsmanPlayerId" error={errors.bestBatsmanPlayerId?.message}>
                            <SquadSelect id="bestBatsmanPlayerId" squad={squad} form={form} />
                          </Field>
                          <Field label="Best bowler" htmlFor="bestBowlerPlayerId" error={errors.bestBowlerPlayerId?.message}>
                            <SquadSelect id="bestBowlerPlayerId" squad={squad} form={form} />
                          </Field>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <Field label="Remarks" htmlFor="remarks">
                  <Textarea
                    id="remarks"
                    rows={2}
                    placeholder="Anything notable about the match"
                    {...form.register('remarks')}
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-3 border-t border-fg/10 pt-4">
                  <Button variant="solar" size="sm" onClick={() => void submit()} loading={save.saving}>
                    {existing ? 'Update result' : 'Save result'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onSelect(null)} disabled={save.saving}>
                    Cancel
                  </Button>
                  <span className="text-[12.5px] text-fg/58">
                    Saving also marks {fixture.matchNo} completed.
                  </span>
                </div>

                <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
                  Save
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Auto-fetched detail
 * ------------------------------------------------------------------ */

function FixtureFacts({
  fixture,
  officials,
  squadSize,
}: {
  fixture: ScheduleMaster;
  officials: string[];
  squadSize: number;
}) {
  const facts: [string, string][] = [
    ['Match', fixture.matchNo],
    ['Sub-group', fixture.subGroupName ?? '—'],
    ['Date & time', `${fixture.matchDate} · ${fixture.matchTime}`],
    ['Venue', fixture.venue || '—'],
    ['Status', fixture.status],
    ['Officials', officials.length ? officials.join(', ') : 'None assigned'],
    ...(fixture.oversPerInnings ? ([['Overs', String(fixture.oversPerInnings)]] as [string, string][]) : []),
    ['Squads', `${squadSize} participants available for awards`],
  ];

  return (
    <div className="rounded-xl border border-fg/12 bg-fg/[0.03] p-4 sm:p-5">
      <p className="text-[15px] font-semibold text-fg">
        {fixture.team1Name} <span className="font-normal text-fg/52">v</span> {fixture.team2Name}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-fg/50">{label}</dt>
            <dd className="truncate text-[13.5px] text-fg/88" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Both squads in one picker, each name tagged with the side it plays for. */
function SquadSelect({
  id,
  squad,
  form,
}: {
  id: keyof ResultValues;
  squad: { id: number; name: string; team: string }[];
  form: ReturnType<typeof useForm<ResultValues>>;
}) {
  return (
    <Select id={id} placeholder="Not awarded" {...form.register(id)}>
      {squad.map((p) => (
        <option key={p.id} value={String(p.id)}>
          {p.name}
          {p.team ? ` · ${p.team}` : ''}
        </option>
      ))}
    </Select>
  );
}
