import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  api,
  type EventMaster,
  type MatchResult,
  type ScheduleMaster,
} from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useOptions } from '@/hooks/useResource';
import { StatTile } from '@/ui/charts';
import { Badge, Button, Card, EmptyState, Spinner } from '@/ui/primitives';
import { SportBanner } from '../SportBanner';
import { DURATION, EASE } from '@/lib/motion.js';
import { localIsoDate } from '@/lib/dates';

/**
 * The Event Management landing page.
 *
 * Match scheduling, rule cards and results entry are each a full screen of
 * their own, and none of them says which fixture needs a result today versus
 * which one merely exists. This page answers that question first — what needs
 * attention right now, in one scan — and hands off to the working screen with
 * the record already chosen, via the same `?match=` / `?edit=` query params
 * those screens read on load.
 *
 * Restricted to the Event Management role (see nav.ts): a Main Admin already
 * has a global Dashboard, and this page's whole point is a single sub-group's
 * worklist, which is the wrong shape for someone who runs every sub-group at
 * once.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from today (local) to `dateIso`; negative once it has passed. */
function daysFrom(dateIso: string): number {
  const today = new Date(`${localIsoDate()}T00:00:00`).getTime();
  return Math.round((new Date(`${dateIso}T00:00:00`).getTime() - today) / DAY_MS);
}

/**
 * Which event this sub-group is actually running.
 *
 * An event's own scope decides relevance — global, pinned to the parent
 * group, or pinned to this exact sub-group — mirroring the same rule the
 * server enforces when a fixture is saved (see validateSchedule in the mock
 * adapter). Preference order: live now, then soonest upcoming, then most
 * recently finished, so there is always something to show once any event
 * exists for this scope.
 */
function pickLiveEvent(
  events: EventMaster[],
  subGroupId: number | null,
  groupId: number | null,
): EventMaster | null {
  const relevant = events.filter((e) => {
    if (e.subGroupId) return e.subGroupId === subGroupId;
    if (e.groupId) return e.groupId === groupId;
    return true;
  });
  if (!relevant.length) return null;
  const todayIso = localIsoDate();

  const current = relevant.find((e) => e.isCurrent);
  if (current) return current;

  const live = relevant.find((e) => e.startDate <= todayIso && e.endDate >= todayIso);
  if (live) return live;

  const upcoming = relevant
    .filter((e) => e.startDate > todayIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) return upcoming;

  return relevant.sort((a, b) => b.endDate.localeCompare(a.endDate))[0]!;
}

export function EventHubPage() {
  const { user, scope } = useAuth();

  const scopeQuery = scope.subGroupId ? { subGroupId: scope.subGroupId } : {};

  const { options: events, loading: eventsLoading } = useOptions(api.events, {});
  const { options: subGroups } = useOptions(api.subGroups, {});
  const { options: fixtures, loading: fixturesLoading } = useOptions(api.schedules, scopeQuery);
  const { options: results } = useOptions(api.matchResults, { pageSize: 1000 });
  const { options: ruleCards } = useOptions(api.ruleCards, scopeQuery);

  const groupId = useMemo(
    () => subGroups.find((sg) => sg.subGroupId === scope.subGroupId)?.groupId ?? null,
    [subGroups, scope.subGroupId],
  );

  const liveEvent = useMemo(
    () => pickLiveEvent(events, scope.subGroupId ?? null, groupId),
    [events, scope.subGroupId, groupId],
  );

  const resultByScheduleId = useMemo(() => {
    const map = new Map<number, MatchResult>();
    for (const r of results) map.set(r.scheduleId, r);
    return map;
  }, [results]);

  const awaitingResults = useMemo(
    () =>
      fixtures
        .filter((f) => f.status === 'Completed' && !resultByScheduleId.has(f.scheduleId))
        .sort((a, b) => a.matchDate.localeCompare(b.matchDate)),
    [fixtures, resultByScheduleId],
  );

  const needsConfirmation = useMemo(
    () => fixtures.filter((f) => f.status === 'Pending').sort((a, b) => a.matchDate.localeCompare(b.matchDate)),
    [fixtures],
  );

  const upcomingWeek = useMemo(
    () =>
      fixtures
        .filter((f) => f.status === 'Scheduled' && f.matchDate >= localIsoDate() && daysFrom(f.matchDate) <= 7)
        .sort((a, b) => a.matchDate.localeCompare(b.matchDate)),
    [fixtures],
  );

  const currentRuleCard = useMemo(
    () => [...ruleCards].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0] ?? null,
    [ruleCards],
  );

  const loading = eventsLoading || fixturesLoading;

  return (
    <>
      <SportBanner
        subGroupName={user?.subGroupName}
        eyebrow="Events"
        title="Event management hub"
        description={
          user?.subGroupName
            ? `Everything ${user.subGroupName} needs attention on today, before the links out to each screen.`
            : 'What needs attention today, before the links out to each screen.'
        }
        actions={
          liveEvent ? (
            <Badge tone="info" glyph="◷">
              {liveEvent.eventCode}
            </Badge>
          ) : null
        }
      />

      <LiveEventCard event={liveEvent} loading={eventsLoading} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting results"
          value={awaitingResults.length}
          caption="played, not yet scored"
          accent="#C72D86"
          loading={loading}
          to={awaitingResults.length ? '/console/results' : undefined}
        />
        <StatTile
          label="Needs confirmation"
          value={needsConfirmation.length}
          caption="fixtures marked Pending"
          accent="#A88500"
          loading={loading}
          to={needsConfirmation.length ? '/console/schedule' : undefined}
        />
        <StatTile
          label="This week"
          value={upcomingWeek.length}
          caption="fixtures in the next 7 days"
          accent="#2475B7"
          loading={loading}
          to="/console/schedule"
        />
        <StatTile
          label="Rule card"
          value={currentRuleCard ? currentRuleCard.version : '—'}
          caption={currentRuleCard ? currentRuleCard.ruleTitle : 'none published'}
          accent={currentRuleCard ? '#00A170' : '#C72D86'}
          loading={loading}
          to="/console/rules"
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <WorkQueue
          title="Awaiting results"
          description="Played, but nothing has been recorded yet. Oldest first."
          rows={awaitingResults}
          loading={loading}
          empty="Every completed fixture has a result recorded."
          actionLabel="Enter result"
          hrefFor={(f) => `/console/results?match=${f.scheduleId}`}
          dateLabel={(f) => f.matchDate}
        />

        <WorkQueue
          title="Needs confirmation"
          description="Marked Pending rather than Scheduled — confirm the date and venue, or set it Scheduled once it is locked in."
          rows={needsConfirmation}
          loading={loading}
          empty="Nothing is waiting on a confirmation."
          actionLabel="Review"
          hrefFor={(f) => `/console/schedule?edit=${f.scheduleId}`}
          dateLabel={(f) => f.matchDate}
        />
      </div>

      <Card
        title="This week"
        action={
          <Link to="/console/schedule" className="text-[12.5px] text-accent-solar underline-offset-2 hover:underline coarse:-my-3 coarse:py-3">
            Full schedule →
          </Link>
        }
        className="mb-5"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-fg/62">
            <Spinner size={16} />
            <span className="text-[13.5px]">Loading fixtures…</span>
          </div>
        ) : upcomingWeek.length ? (
          <ul className="divide-y divide-fg/12">
            {upcomingWeek.map((fixture) => (
              <motion.li
                key={fixture.scheduleId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DURATION.fast, ease: EASE.luxe }}
              >
                <Link
                  to={`/console/schedule?edit=${fixture.scheduleId}`}
                  className="-mx-2 flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-fg/[0.06]"
                >
                  <span className="font-mono text-[12.5px] text-accent-solar">{fixture.matchNo}</span>
                  <span className="min-w-0 flex-1 text-[14px] text-fg/90">
                    {fixture.team1Name} <span className="text-fg/52">v</span> {fixture.team2Name}
                  </span>
                  <span className="font-mono text-[12.5px] text-fg/68">
                    {fixture.matchDate} · {fixture.matchTime}
                  </span>
                  <Badge tone="success" glyph="▸">
                    in {Math.max(daysFrom(fixture.matchDate), 0)}d
                  </Badge>
                </Link>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-[13.5px] text-fg/58">
            Nothing scheduled in the next seven days.
          </p>
        )}
      </Card>

      <QuickLinks />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The current event, in context
 * ------------------------------------------------------------------ */

function LiveEventCard({ event, loading }: { event: EventMaster | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass mb-5 flex items-center gap-3 rounded-2xl px-5 py-4 text-fg/62">
        <Spinner size={16} />
        <span className="text-[13.5px]">Finding your event…</span>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mb-5">
        <EmptyState
          glyph="◷"
          title="No event scheduled yet"
          description="Nothing has been set up for your sub-group. Ask the Main Administrator to create the event, then fixtures, rules and results can be entered here."
        />
      </div>
    );
  }

  const remaining = daysFrom(event.endDate);
  const untilStart = daysFrom(event.startDate);
  const isLive = untilStart <= 0 && remaining >= 0;

  const status = isLive
    ? { tone: 'success' as const, glyph: '●', label: remaining === 0 ? 'Ends today' : `${remaining} day${remaining === 1 ? '' : 's'} left` }
    : untilStart > 0
      ? { tone: 'info' as const, glyph: '◷', label: `Starts in ${untilStart} day${untilStart === 1 ? '' : 's'}` }
      : { tone: 'neutral' as const, glyph: '✓', label: `Ended ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? '' : 's'} ago` };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.luxe }}
      className="glass mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:px-6"
    >
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-hud text-fg/52">{event.eventCode}</p>
        <p className="mt-0.5 truncate text-[16px] font-semibold text-fg">{event.eventName}</p>
        <p className="mt-1 text-[12.5px] text-fg/58">
          {event.startDate} <span className="text-fg/38">→</span> {event.endDate}
          {event.seasonName ? ` · ${event.seasonName}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={status.tone} glyph={status.glyph}>
          {status.label}
        </Badge>
        <Link
          to="/console/events"
          className="rounded-full border border-fg/22 px-3 py-1.5 text-[12.5px] text-fg/82 transition-colors hover:border-fg/48 hover:text-fg"
        >
          Details →
        </Link>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * A short, actionable list
 * ------------------------------------------------------------------ */

function WorkQueue({
  title,
  description,
  rows,
  loading,
  empty,
  actionLabel,
  hrefFor,
  dateLabel,
}: {
  title: string;
  description: string;
  rows: ScheduleMaster[];
  loading: boolean;
  empty: string;
  actionLabel: string;
  hrefFor: (row: ScheduleMaster) => string;
  dateLabel: (row: ScheduleMaster) => string;
}) {
  const LIMIT = 6;
  const shown = rows.slice(0, LIMIT);

  return (
    <Card title={title}>
      <p className="-mt-1 mb-4 text-[12.5px] leading-relaxed text-fg/58">{description}</p>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-8 text-fg/62">
          <Spinner size={16} />
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-phthalo-500/25 bg-phthalo-500/[0.06] px-4 py-3 text-[13px] text-fg/78">
          <span aria-hidden="true" className="mr-2 text-accent-phthalo">
            ✓
          </span>
          {empty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((row) => (
            <li key={row.scheduleId}>
              <Link
                to={hrefFor(row)}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-fg/12 px-3 py-2.5 transition-colors hover:border-fg/28 hover:bg-fg/[0.04]"
              >
                <span className="font-mono text-[12px] text-accent-solar">{row.matchNo}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg/88">
                  {row.team1Name} <span className="text-fg/45">v</span> {row.team2Name}
                </span>
                <span className="font-mono text-[11.5px] text-fg/55">{dateLabel(row)}</span>
                <Button variant="subtle" size="sm" className="pointer-events-none">
                  {actionLabel}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rows.length > LIMIT && (
        <p className="mt-3 text-[12px] text-fg/52">
          +{rows.length - LIMIT} more — the full list is on the relevant screen.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Direct routes into the four screens this role runs
 * ------------------------------------------------------------------ */

const LINKS: { to: string; label: string; glyph: string; description: string }[] = [
  { to: '/console/events', label: 'Event scheduling', glyph: '◷', description: 'The window this competition runs in' },
  { to: '/console/schedule', label: 'Match scheduling', glyph: '▤', description: 'Fixtures, officials and venues' },
  { to: '/console/results', label: 'Results & winners', glyph: '★', description: 'Scores, winners and awards' },
  { to: '/console/rules', label: 'Rule cards', glyph: '§', description: 'Playing conditions, versioned' },
];

function QuickLinks() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {LINKS.map((link, index) => (
        <motion.div
          key={link.to}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE.luxe, delay: index * 0.04 }}
        >
          <Link
            to={link.to}
            className="lift glass flex h-full flex-col rounded-2xl p-5 transition-colors hover:border-fg/28"
          >
            <span
              aria-hidden="true"
              className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-fg/16 bg-fg/[0.06] text-[15.5px] text-fg/78"
            >
              {link.glyph}
            </span>
            <span className="text-[14.5px] font-semibold text-fg">{link.label}</span>
            <span className="mt-1 text-[12.5px] leading-relaxed text-fg/62">{link.description}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
