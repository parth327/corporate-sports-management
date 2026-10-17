import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type DashboardSummary } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useOptions } from '@/hooks/useResource';
import {
  BarChart,
  CATEGORICAL,
  DonutChart,
  DualLineChart,
  FillMeters,
  FunnelChart,
  LineChart,
  RankedBars,
  StackedBarChart,
  StatTile,
  type DonutSegment,
} from '@/ui/charts';
import { StandingsTable } from '../Standings';
import { Badge, Card, ErrorPanel, Field, PageHeader, Select, Spinner } from '@/ui/primitives';
import { Toolbar } from '@/ui/DataTable';

/**
 * The overview screen.
 *
 * One rule governs the layout: the page answers "what is the state of the
 * season" without scrolling, and everything that needs precision lives one
 * drill-down below. Counts go in tiles, comparisons in bars, change in a line,
 * and the only table is the short list of what happens next.
 *
 * An Event Team user's figures are filtered to their own sub-group by the
 * server, which is both the usability feature and the authorisation control.
 */

const STATUS_META: Record<string, { tone: DonutSegment['tone']; glyph: string }> = {
  Scheduled: { tone: 'good', glyph: '▸' },
  Completed: { tone: 'info', glyph: '✓' },
  Pending: { tone: 'warning', glyph: '◐' },
  Cancelled: { tone: 'critical', glyph: '✕' },
};

const OUTCOME_META: Record<string, { tone: DonutSegment['tone']; glyph: string }> = {
  Decided: { tone: 'good', glyph: '★' },
  Drawn: { tone: 'info', glyph: '=' },
  'No result': { tone: 'warning', glyph: '○' },
};

export default function DashboardPage() {
  const { user, isGlobal, scope } = useAuth();
  const [subGroupId, setSubGroupId] = useState<string>('');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  /* Retry needs to change something the effect depends on. Re-setting the
     filter to its current value would be a no-op — React bails out. */
  const [reloadKey, setReloadKey] = useState(0);

  const { options: subGroups } = useOptions(api.subGroups, {}, { enabled: isGlobal });

  const effectiveSubGroup = isGlobal ? (subGroupId ? Number(subGroupId) : null) : (scope.subGroupId ?? null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    api
      .dashboard({ subGroupId: effectiveSubGroup }, controller.signal)
      .then((value) => active && setSummary(value))
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
  }, [effectiveSubGroup, reloadKey]);

  const donutSegments: DonutSegment[] =
    summary?.scheduleStatus.map((s) => ({
      label: s.label,
      value: s.value,
      tone: STATUS_META[s.label]?.tone ?? 'info',
      glyph: STATUS_META[s.label]?.glyph ?? '●',
    })) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Good to see you, ${user?.displayName.split(' ')[0] ?? ''}`}
        description={
          isGlobal
            ? 'Every group and sub-group across the current season.'
            : `Filtered automatically to ${user?.subGroupName ?? 'your sub-group'} — you only see what you can act on.`
        }
        actions={
          !isGlobal && user?.subGroupName ? (
            <Badge tone="info" glyph="◆">
              {user.subGroupName}
            </Badge>
          ) : null
        }
      />

      {isGlobal && (
        <Toolbar>
          <Field label="Sub-group" htmlFor="dash-subgroup" className="w-full sm:w-60">
            <Select
              id="dash-subgroup"
              value={subGroupId}
              placeholder="All sub-groups"
              onChange={(event) => setSubGroupId(event.target.value)}
            >
              {subGroups.map((s) => (
                <option key={s.subGroupId} value={String(s.subGroupId)}>
                  {s.subGroupName}
                </option>
              ))}
            </Select>
          </Field>
        </Toolbar>
      )}

      {error && (
        <div className="mb-5">
          <ErrorPanel message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Participants" value={summary?.players ?? 0} caption="registered and active" accent={CATEGORICAL[0]} loading={loading} to="/console/participants" />
        <StatTile label="Teams" value={summary?.teams ?? 0} caption="across sub-groups" accent={CATEGORICAL[1]} loading={loading} to="/console/teams" />
        <StatTile label="Matches" value={summary?.matches ?? 0} caption="in the fixture list" accent={CATEGORICAL[2]} loading={loading} to="/console/schedule" />
        {/* Results due is the only tile that is a call to action rather than a
            count, so it says what is outstanding, not what has been done. */}
        <StatTile
          label="Results"
          value={summary?.resultsRecorded ?? 0}
          caption={summary?.resultsDue ? `${summary.resultsDue} still to enter` : 'all matches scored'}
          accent={CATEGORICAL[3]}
          loading={loading}
          to="/console/results"
        />
        {/* The user register is Main Admin only, so the tile is a dead number
            for everyone else rather than a link into a 403. */}
        <StatTile
          label="Active users"
          value={summary?.activeUsers ?? 0}
          caption="admin + event team"
          accent={CATEGORICAL[1]}
          loading={loading}
          to={isGlobal ? '/console/admin/users' : undefined}
        />
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center gap-3 py-20 text-fg/62">
          <Spinner size={18} />
          <span className="text-[13.5px]">Building your dashboard…</span>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <BarChart
              className="lg:col-span-2"
              title="Participants by sub-group"
              subtitle="Active participants in the current season"
              data={summary?.registrationsBySubGroup.map((r) => ({ label: r.label, value: r.value })) ?? []}
            />
            <DonutChart
              title="Schedule status"
              subtitle="Every fixture in scope"
              centreLabel="matches"
              segments={donutSegments}
            />
          </div>

          {/* The pipeline and the composition answer the two questions a
              Management Team opens this page with: how far through the
              register are we, and is any sub-group lopsided. */}
          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <FunnelChart
              title="Classification pipeline"
              subtitle="Where the register stops — each step is a subset of the one above"
              data={summary?.classificationFunnel ?? []}
            />
            <StackedBarChart
              title="Squad composition by sub-group"
              subtitle="Participants by type, including anyone still unclassified"
              data={summary?.typeComposition ?? []}
            />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <LineChart
              title="Participants classified over time"
              subtitle="Cumulative, last eight weeks"
              data={summary?.registrationsOverTime ?? []}
            />
            <DualLineChart
              title="Match activity"
              subtitle="What was on the card against what has been scored"
              data={summary?.matchesOverTime.map((m) => ({ label: m.label, a: m.played, b: m.scheduled })) ?? []}
              seriesA="Results in"
              seriesB="Scheduled"
            />
          </div>

          <div className="mb-5">
            <StandingsTable rows={summary?.standings ?? []} limit={12} />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <FillMeters
              className="lg:col-span-2"
              title="Team allocation fill"
              subtitle="Allocated participants against configured capacity"
              data={summary?.teamFill.map((t) => ({ label: t.label, allocated: t.allocated, capacity: t.capacity })) ?? []}
            />
            <DonutChart
              title="How matches finished"
              subtitle="Across every recorded result"
              centreLabel="results"
              segments={
                summary?.outcomeSplit.map((o) => ({
                  label: o.label,
                  value: o.value,
                  tone: OUTCOME_META[o.label]?.tone ?? 'info',
                  glyph: OUTCOME_META[o.label]?.glyph ?? '●',
                })) ?? []
              }
            />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <RankedBars
              title="Most decorated participants"
              subtitle="Player of the match, best batter and best bowler combined"
              data={summary?.topAwards ?? []}
              valueLabel="awards"
              emptyMessage="No awards recorded yet — they are entered with each result."
            />

            <Card
            title="Next up"
            action={
              <Link to="/console/schedule" className="text-[12.5px] text-accent-solar underline-offset-2 hover:underline coarse:-my-3 coarse:py-3">
                Full schedule →
              </Link>
            }
          >
            {summary?.upcoming.length ? (
              <ul className="divide-y divide-fg/12">
                {summary.upcoming.map((fixture) => (
                  <li key={fixture.scheduleId}>
                    <Link
                      to="/console/schedule"
                      className="-mx-2 flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-fg/[0.06]"
                    >
                      <span className="font-mono text-[12.5px] text-accent-solar">{fixture.matchNo}</span>
                      <span className="min-w-0 flex-1 text-[14px] text-fg/90">
                        {fixture.team1Name} <span className="text-fg/52">v</span> {fixture.team2Name}
                      </span>
                      <span className="font-mono text-[12.5px] text-fg/68">
                        {fixture.matchDate} · {fixture.matchTime}
                      </span>
                      <Badge tone={fixture.status === 'Pending' ? 'warning' : 'success'} glyph={fixture.status === 'Pending' ? '◐' : '▸'}>
                        {fixture.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-[13.5px] text-fg/58">
                No upcoming fixtures in scope.
              </p>
            )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
