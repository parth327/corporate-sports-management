import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  api,
  ApiError,
  downloadReport,
  type ExportFormat,
  type HistoryFilters,
  type HistoryResult,
} from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useMutation, useOptions } from '@/hooks/useResource';
import { StandingsTable } from '../Standings';
import { Toolbar } from '@/ui/DataTable';
import {
  Badge,
  Button,
  ErrorPanel,
  Field,
  PageHeader,
  Select,
  Spinner,
} from '@/ui/primitives';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * The archive.
 *
 * Distinct from Exports on purpose. Exports is "pick a canned report and
 * download it"; this is "find the slice you care about, look at it, then take
 * it away". The filters cascade the way the season is actually structured —
 * year → season → event → sub-group → match — and the very same filter object
 * is posted to the export endpoint, so a downloaded file cannot disagree with
 * the screen it came from.
 */

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: 'XLS', label: 'Excel' },
  { format: 'CSV', label: 'CSV' },
  { format: 'PDF', label: 'PDF' },
];

const OUTCOME_TONE: Record<string, 'success' | 'info' | 'neutral' | 'warning'> = {
  Decided: 'success',
  'Draw — both share': 'info',
  'No result': 'neutral',
  'Awaiting result': 'warning',
};

export default function HistoryPage() {
  const { scope, isGlobal } = useAuth();
  const toast = useToast();

  const [year, setYear] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [eventId, setEventId] = useState('');
  const [subGroupId, setSubGroupId] = useState('');
  const [scheduleId, setScheduleId] = useState('');

  const [data, setData] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const { options: seasons } = useOptions(api.seasons, {});
  const { options: events } = useOptions(api.events, {});
  const { options: subGroups } = useOptions(api.subGroups, {}, { enabled: isGlobal });

  const years = useMemo(
    () => [...new Set(seasons.map((s) => s.year))].sort((a, b) => b - a),
    [seasons],
  );

  /* Each level offers only what the level above it leaves possible, so the
     screen can never be put into a combination that returns nothing. */
  const availableSeasons = useMemo(
    () => (year ? seasons.filter((s) => String(s.year) === year) : seasons),
    [seasons, year],
  );

  const availableEvents = useMemo(
    () =>
      events.filter((e) => {
        if (seasonId && String(e.seasonId) !== seasonId) return false;
        if (year && String(e.year ?? '') !== year) return false;
        return true;
      }),
    [events, seasonId, year],
  );

  const filters: HistoryFilters = useMemo(
    () => ({
      year: year ? Number(year) : null,
      seasonId: seasonId ? Number(seasonId) : null,
      eventId: eventId ? Number(eventId) : null,
      subGroupId: isGlobal ? (subGroupId ? Number(subGroupId) : null) : (scope.subGroupId ?? null),
      scheduleId: scheduleId ? Number(scheduleId) : null,
    }),
    [year, seasonId, eventId, subGroupId, scheduleId, isGlobal, scope.subGroupId],
  );

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    api
      .history(JSON.parse(filterKey) as HistoryFilters, controller.signal)
      .then((value) => active && setData(value))
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof ApiError ? cause : new ApiError(String(cause), 0));
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      controller.abort();
    };
  }, [filterKey, reloadKey]);

  /**
   * The match picker lists what the OTHER filters narrowed to, never what the
   * picker itself narrowed to.
   *
   * Reading it off `data.rows` was the obvious thing and a trap: selecting a
   * match filters the response down to that one row, which collapses the
   * dropdown to a single option and leaves no way to switch matches without
   * clearing everything first. So the list is held from the last response that
   * had no match pinned.
   */
  const [matchOptions, setMatchOptions] = useState<HistoryResult['rows']>([]);

  useEffect(() => {
    if (!scheduleId && data) setMatchOptions(data.rows);
  }, [data, scheduleId]);

  const exportMutation = useMutation(async (reportType: 'matchHistory' | 'standings', format: ExportFormat) =>
    downloadReport({ reportType, format, filters }),
  );

  const runExport = async (reportType: 'matchHistory' | 'standings', format: ExportFormat) => {
    const key = `${reportType}:${format}`;
    setBusy(key);
    try {
      await exportMutation.run(reportType, format);
      toast.success(
        `${reportType === 'standings' ? 'Standings' : 'History'} exported`,
        `${data?.total ?? 0} matches in scope · downloaded as ${format}.`,
      );
    } catch (cause) {
      toast.error('Export failed', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setYear('');
    setSeasonId('');
    setEventId('');
    setSubGroupId('');
    setScheduleId('');
  };

  const anyFilter = Boolean(year || seasonId || eventId || subGroupId || scheduleId);

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="History"
        description="The match record, filtered the way the season is structured — year, season, event, sub-group, fixture. Matches still awaiting a result are included so the picture is the whole event, not just the part that is finished. What you export is exactly the slice you are looking at."
        actions={
          data ? (
            <Badge tone="info" glyph="▤">
              {data.total} {data.total === 1 ? 'match' : 'matches'}
            </Badge>
          ) : null
        }
      />

      <Toolbar>
        <Field label="Year" htmlFor="hist-year" className="w-full sm:w-32">
          <Select
            id="hist-year"
            value={year}
            placeholder="Any year"
            onChange={(event) => {
              setYear(event.target.value);
              setSeasonId('');
              setEventId('');
              setScheduleId('');
            }}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Season" htmlFor="hist-season" className="w-full sm:w-44">
          <Select
            id="hist-season"
            value={seasonId}
            placeholder="Any season"
            onChange={(event) => {
              setSeasonId(event.target.value);
              setEventId('');
              setScheduleId('');
            }}
          >
            {availableSeasons.map((s) => (
              <option key={s.seasonId} value={String(s.seasonId)}>
                {s.seasonName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Event" htmlFor="hist-event" className="w-full sm:w-56">
          <Select
            id="hist-event"
            value={eventId}
            placeholder="Any event"
            onChange={(event) => {
              setEventId(event.target.value);
              setScheduleId('');
            }}
          >
            {availableEvents.map((e) => (
              <option key={e.eventId} value={String(e.eventId)}>
                {e.eventCode} — {e.eventName}
              </option>
            ))}
          </Select>
        </Field>

        {isGlobal && (
          <Field label="Sub-group" htmlFor="hist-subgroup" className="w-full sm:w-44">
            <Select
              id="hist-subgroup"
              value={subGroupId}
              placeholder="All sub-groups"
              onChange={(event) => {
                setSubGroupId(event.target.value);
                setScheduleId('');
              }}
            >
              {subGroups.map((s) => (
                <option key={s.subGroupId} value={String(s.subGroupId)}>
                  {s.subGroupName}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Match" htmlFor="hist-match" className="w-full sm:w-64">
          <Select
            id="hist-match"
            value={scheduleId}
            placeholder="Every match in scope"
            onChange={(event) => setScheduleId(event.target.value)}
          >
            {matchOptions.map((row) => (
              <option key={row.scheduleId} value={String(row.scheduleId)}>
                {row.matchNo} — {row.team1Name} v {row.team2Name}
              </option>
            ))}
          </Select>
        </Field>

        {anyFilter && (
          <Button variant="ghost" size="sm" onClick={reset} className="w-full sm:mb-2.5 sm:w-auto">
            Clear filters
          </Button>
        )}
      </Toolbar>

      {error && (
        <div className="mb-5">
          <ErrorPanel message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      )}

      {/* Export sits directly above the data it exports, not on another page. */}
      <div className="glass mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl p-4">
        <p className="text-[13px] text-fg/72">
          <span aria-hidden="true" className="mr-2 text-accent-solar">
            ↧
          </span>
          Export the {data?.total ?? 0} {data?.total === 1 ? 'match' : 'matches'} shown below
        </p>
        <div className="flex flex-wrap gap-2">
          {EXPORTS.map(({ format, label }) => (
            <Button
              key={format}
              variant="subtle"
              size="sm"
              loading={busy === `matchHistory:${format}`}
              disabled={(busy !== null && busy !== `matchHistory:${format}`) || !data?.total}
              onClick={() => void runExport('matchHistory', format)}
            >
              {label}
            </Button>
          ))}
        </div>

        <span aria-hidden="true" className="hidden h-5 w-px bg-fg/14 sm:block" />

        <p className="text-[13px] text-fg/72">Or just the points table</p>
        <div className="flex flex-wrap gap-2">
          {EXPORTS.map(({ format, label }) => (
            <Button
              key={format}
              variant="ghost"
              size="sm"
              loading={busy === `standings:${format}`}
              disabled={(busy !== null && busy !== `standings:${format}`) || !data?.standings.length}
              onClick={() => void runExport('standings', format)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-3 py-20 text-fg/62">
          <Spinner size={18} />
          <span className="text-[13.5px]">Reading the archive…</span>
        </div>
      ) : (
        <>
          {data && data.total > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Played', data.summary.played],
                ['Decided', data.summary.decided],
                ['Drawn', data.summary.drawn],
                ['No result', data.summary.noResult],
                ['Awaiting', data.summary.awaiting],
              ].map(([label, value], index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE.luxe, delay: index * 0.04 }}
                  className="glass rounded-xl px-4 py-3"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-fg/58">
                    {label}
                  </p>
                  <p className="mt-1 font-display text-2xl leading-none tabular-nums text-fg">
                    {value}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          <div className="glass mb-5 overflow-hidden rounded-2xl">
            {!data?.rows.length ? (
              <p className="px-5 py-16 text-center text-[13.5px] text-fg/58">
                {anyFilter
                  ? 'No matches under these filters. Widen the year, season or event.'
                  : 'No matches on record yet.'}
              </p>
            ) : (
              <div className="scroll-hint-x overflow-x-auto">
                <table className="w-full min-w-[840px] text-[13px]">
                  <thead>
                    <tr className="border-b border-fg/12 text-left text-[11.5px] font-bold uppercase tracking-[0.08em] text-fg/58">
                      <th scope="col" className="py-2.5 pl-5">Match</th>
                      <th scope="col" className="py-2.5">Played</th>
                      <th scope="col" className="py-2.5">Event</th>
                      <th scope="col" className="py-2.5">Sides</th>
                      <th scope="col" className="py-2.5">Score</th>
                      <th scope="col" className="py-2.5">Outcome</th>
                      <th scope="col" className="py-2.5 pr-5">Player of the match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, index) => (
                      <motion.tr
                        key={row.scheduleId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: DURATION.fast, delay: Math.min(index, 20) * 0.015 }}
                        className="border-b border-fg/8 last:border-0"
                      >
                        <td className="py-2.5 pl-5 font-mono text-[12.5px] text-accent-solar">
                          {row.matchNo}
                        </td>
                        <td className="py-2.5 font-mono text-[12.5px] text-fg/72">
                          {row.matchDate}
                          <span className="ml-1.5 text-fg/45">{row.matchTime}</span>
                        </td>
                        <td className="py-2.5">
                          <span className="block text-fg/86">{row.eventCode}</span>
                          <span className="block text-[11.5px] text-fg/52">
                            {row.year} · {row.subGroupName}
                          </span>
                        </td>
                        <td className="py-2.5 text-fg/90">
                          {row.team1Name} <span className="text-fg/45">v</span> {row.team2Name}
                        </td>
                        <td className="py-2.5 font-mono text-[12.5px] text-fg/86">
                          {row.scoreLine || <span className="text-fg/40">—</span>}
                        </td>
                        <td className="py-2.5">
                          <Badge tone={OUTCOME_TONE[row.outcome] ?? 'neutral'} glyph="●">
                            {row.winningTeamName ?? row.outcome}
                          </Badge>
                          {row.margin && (
                            <span className="ml-2 text-[12px] text-fg/58">{row.margin}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-5 text-fg/78">
                          {row.manOfTheMatchName ?? <span className="text-fg/40">—</span>}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* The ladder for this slice, not for the whole season. */}
          <StandingsTable rows={data?.standings ?? []} />
        </>
      )}
    </>
  );
}
