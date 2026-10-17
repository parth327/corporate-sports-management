import { forwardRef, useMemo } from 'react';
import clsx from 'clsx';
import { FORMATIONS, PLAYERS, ROLES, ROLE_COLOR, type Role, type Slot } from '../data/squad';
import { useBuilder } from '../store/builderStore';
import type { CardVariant } from '../store/spatialBridge';
import { PlayerCard } from './PlayerCard';
import { Segmented, type SegmentOption } from './Segmented';

const ROLE_ORDER: Role[] = ['GK', 'DEF', 'MID', 'FWD'];

/* Each name starts with the visible text ("GK, keepers"), so voice control can say what it sees. */
const FILTERS: SegmentOption<Role | 'ALL'>[] = [
  { id: 'ALL', label: 'All', name: 'All players' },
  ...ROLES.map((role) => ({
    id: role.id,
    label: role.id,
    name: `${role.id}, ${role.label.toLowerCase()}`,
    color: ROLE_COLOR[role.id],
  })),
];

/** Keeper first, then back to front; best first within each line. */
const SORTED = [...PLAYERS].sort(
  (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.rating - a.rating,
);

/**
 * The squad, on glass. A side rail on wide screens, a bottom strip that
 * scrolls sideways on phones; either way the WebGL arena shows through,
 * blurred, and dropping a player back onto it sends them to the bench.
 */
export const RosterPanel = forwardRef<HTMLElement, { variant: CardVariant }>(function RosterPanel({ variant }, ref) {
  const roleFilter = useBuilder((s) => s.roleFilter);
  const setRoleFilter = useBuilder((s) => s.setRoleFilter);
  const lineup = useBuilder((s) => s.lineup);
  const formation = useBuilder((s) => s.formation);
  const targetSlot = useBuilder((s) => s.targetSlot);

  const positions = useMemo(() => {
    const map = new Map<string, Slot>();
    lineup.forEach((id, index) => {
      const slot = FORMATIONS[formation][index];
      if (id && slot) map.set(id, slot);
    });
    return map;
  }, [lineup, formation]);

  const players = roleFilter === 'ALL' ? SORTED : SORTED.filter((p) => p.role === roleFilter);
  const benched = PLAYERS.length - positions.size;
  const target = targetSlot >= 0 ? FORMATIONS[formation][targetSlot] : undefined;
  const rail = variant === 'rail';

  return (
    <section
      ref={ref}
      aria-labelledby="tb-roster-title"
      className={clsx(
        'tb-glass pointer-events-auto flex min-h-0 flex-col overflow-hidden',
        /* The rail fills its column; the strip is only as tall as one row of cards, so the pitch keeps the rest. */
        rail ? 'h-full rounded-[1.6rem]' : 'rounded-t-[1.4rem] border-b-0',
      )}
    >
      <header className={clsx('flex shrink-0 flex-col gap-[0.7em] tb-fs-body', rail ? 'px-[1.1em] pb-[0.9em] pt-[1.1em]' : 'px-4 pb-2.5 pt-3')}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {rail && <p className="tb-fs-micro font-mono uppercase tracking-hud text-white/60">Squad · 22 players</p>}
            {/* One line, always: a title that wrapped would resize the strip, and the camera would reframe. */}
            <h2 id="tb-roster-title" className={clsx('tb-fs-title truncate font-display text-white', rail && 'mt-1')}>
              {target ? `Pick a ${target.name.toLowerCase()}` : 'Build your XI'}
            </h2>
          </div>
          <p className="tb-fs-small shrink-0 text-right text-white/70">
            <span className="font-display text-white">{benched}</span> on the bench
          </p>
        </div>
        <Segmented id="tb-role" label="Show players by role" options={FILTERS} value={roleFilter} onChange={setRoleFilter} className="self-start" />
      </header>

      <ul
        aria-label={roleFilter === 'ALL' ? 'All players' : ROLES.find((r) => r.id === roleFilter)?.label}
        className={clsx(
          'tb-scroll min-h-0 flex-1',
          rail
            ? 'flex flex-col gap-[0.55em] overflow-y-auto px-[1.1em] pb-[1.1em] pt-1 tb-fs-body'
            : 'flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-1 tb-fs-body',
        )}
      >
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} slot={positions.get(player.id) ?? null} variant={variant} />
        ))}
      </ul>

      <p id="tb-card-help" className="sr-only">
        Drag the card onto a glowing position on the pitch. Or press Enter to pick the player up, then choose a
        position with the arrow keys and press Enter again.
      </p>
    </section>
  );
});
