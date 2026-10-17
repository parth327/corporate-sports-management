import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { StandingsRow } from '@/api/types';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * The points table.
 *
 * Derived from match results on every read, never stored. A standings table
 * that can drift from the results it summarises is worse than none at all —
 * it looks authoritative and is quietly wrong — so there is deliberately no
 * cached copy anywhere for an edited result to leave stale.
 *
 * Ordering is points, then score difference, then name: what every league
 * uses, and what a reader will assume without being told.
 */

const HEADS: { key: keyof StandingsRow | 'diff' | 'rank'; label: string; full: string }[] = [
  { key: 'rank', label: '#', full: 'Position' },
  { key: 'teamName', label: 'Team', full: 'Team' },
  { key: 'played', label: 'P', full: 'Played' },
  { key: 'won', label: 'W', full: 'Won' },
  { key: 'drawn', label: 'D', full: 'Drawn' },
  { key: 'lost', label: 'L', full: 'Lost' },
  { key: 'noResult', label: 'NR', full: 'No result' },
  { key: 'diff', label: '+/−', full: 'Score difference' },
  { key: 'points', label: 'Pts', full: 'Points' },
];

export function StandingsTable({
  rows,
  className,
  limit,
}: {
  rows: StandingsRow[];
  className?: string;
  limit?: number;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;

  if (!shown.length) {
    return (
      <div className={clsx('glass rounded-2xl p-5', className)}>
        <h2 className="text-[12px] font-bold uppercase tracking-[0.13em] text-fg/72">Standings</h2>
        <p className="py-8 text-center text-[13.5px] text-fg/58">
          Nothing to rank yet — the table fills in as results are recorded.
        </p>
      </div>
    );
  }

  /* Grouped by sub-group, because a cricket side and a football side sharing
     one ladder would be a meaningless comparison. */
  const bySubGroup = new Map<string, StandingsRow[]>();
  for (const row of shown) {
    const key = row.subGroupName ?? 'Unassigned';
    bySubGroup.set(key, [...(bySubGroup.get(key) ?? []), row]);
  }

  return (
    <div className={clsx('glass overflow-hidden rounded-2xl', className)}>
      <div className="px-5 pt-5">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.13em] text-fg/72">Standings</h2>
        <p className="mt-1 text-[12.5px] text-fg/58">
          Points, then score difference. Computed from recorded results.
        </p>
      </div>

      <div className="scroll-hint-x mt-4 overflow-x-auto">
        {[...bySubGroup.entries()].map(([subGroup, group]) => (
          <table key={subGroup} className="w-full min-w-[540px] text-[13px]">
            <caption className="px-5 pb-1.5 pt-3 text-left text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent-solar">
              {subGroup}
            </caption>
            <thead>
              <tr className="border-y border-fg/12 text-fg/58">
                {HEADS.map((head, index) => (
                  <th
                    key={head.key}
                    scope="col"
                    className={clsx(
                      'py-2 text-[11.5px] font-bold uppercase tracking-[0.08em]',
                      index === 0 && 'pl-5',
                      index === 1 ? 'text-left' : 'text-right',
                      index === HEADS.length - 1 && 'pr-5',
                    )}
                  >
                    <abbr title={head.full} className="no-underline">
                      {head.label}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.map((row, index) => {
                const diff = row.scoreFor - row.scoreAgainst;
                return (
                  <motion.tr
                    key={row.teamId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: DURATION.base, ease: EASE.luxe, delay: index * 0.025 }}
                    className="border-b border-fg/8 last:border-0"
                  >
                    <td className="py-2 pl-5 text-right font-mono text-[12px] tabular-nums text-fg/45">
                      {index + 1}
                    </td>
                    <td className="py-2 pl-3">
                      <span className="font-semibold text-fg">{row.teamName}</span>
                      <span className="ml-2 font-mono text-[11.5px] text-fg/45">{row.teamCode}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-fg/78">{row.played}</td>
                    <td className="py-2 text-right tabular-nums text-fg/78">{row.won}</td>
                    <td className="py-2 text-right tabular-nums text-fg/78">{row.drawn}</td>
                    <td className="py-2 text-right tabular-nums text-fg/78">{row.lost}</td>
                    <td className="py-2 text-right tabular-nums text-fg/58">{row.noResult}</td>
                    <td
                      className={clsx(
                        'py-2 text-right tabular-nums',
                        diff > 0 ? 'text-accent-phthalo' : diff < 0 ? 'text-fg/58' : 'text-fg/78',
                      )}
                    >
                      {diff > 0 ? '+' : ''}
                      {diff}
                    </td>
                    <td className="py-2 pr-5 text-right font-semibold tabular-nums text-fg">
                      {row.points}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>

      {limit && rows.length > limit && (
        <p className="px-5 py-3 text-[12px] text-fg/52">
          Showing {limit} of {rows.length} teams.
        </p>
      )}
    </div>
  );
}
