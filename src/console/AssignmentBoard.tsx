import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import type { PlayerMaster } from '@/api';
import { Badge, Button, EmptyState, ErrorPanel, Input, Spinner } from '@/ui/primitives';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * The shared surface behind the group and sub-group assignment screens.
 *
 * Both do the same thing — tick some participants, press a target — so the only
 * things that differ are the list they are fed and the buttons along the
 * bottom. Keeping one component means the selection rules, the "N selected"
 * bar and the partial-failure reporting behave identically on both, which
 * matters because a moderator moves between them in a single sitting.
 *
 * Selection deliberately survives paging: a sub-group is often filled from
 * two or three pages of a long register, and losing the ticks on every page
 * turn would make the screen unusable for its actual job.
 */

export interface AssignTarget {
  id: number;
  label: string;
  hint?: string;
  /** Tailwind classes for the button's accent, so targets stay distinguishable. */
  tone?: string;
}

interface AssignmentBoardProps {
  participants: PlayerMaster[];
  total: number;
  loading: boolean;
  error: { message: string } | null;
  onRetry: () => void;

  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  /** What this participant currently holds at the level being edited. */
  currentOf: (row: PlayerMaster) => string | null;
  /** Secondary line under the name — department, classification path, etc. */
  detailOf?: (row: PlayerMaster) => ReactNode;

  targets: AssignTarget[];
  /** Receives the ticked ids — the board owns selection, the page owns the call. */
  onAssign: (targetId: number, selectedIds: number[]) => Promise<void>;
  /** Target currently being written, so only that button spins. */
  pending: number | null;
  canEdit: boolean;

  /** Rows the last call refused, keyed by reason. */
  skipped: { playerId: number; name: string; reason: string }[];
  onDismissSkipped: () => void;

  emptyTitle: string;
  emptyBody: string;
  /** Rendered above the list — the cascading filters on the sub-group screen. */
  filters?: ReactNode;
  children?: ReactNode;
}

export function AssignmentBoard({
  participants,
  total,
  loading,
  error,
  onRetry,
  search,
  onSearchChange,
  searchPlaceholder = 'Search name, email or department…',
  currentOf,
  detailOf,
  targets,
  onAssign,
  pending,
  canEdit,
  skipped,
  onDismissSkipped,
  emptyTitle,
  emptyBody,
  filters,
  children,
}: AssignmentBoardProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const visibleIds = useMemo(() => participants.map((r) => r.playerId), [participants]);
  const selectedOnPage = visibleIds.filter((id) => selected.has(id));
  const allOnPageSelected = visibleIds.length > 0 && selectedOnPage.length === visibleIds.length;

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allOnPageSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const clear = () => setSelected(new Set());

  const assign = async (targetId: number) => {
    await onAssign(targetId, [...selected]);
    clear();
  };

  return (
    <div className="space-y-4">
      {error && <ErrorPanel message={error.message} onRetry={onRetry} />}

      {/* Partial failures — the server takes what it can and reports the rest. */}
      <AnimatePresence>
        {skipped.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE.smooth }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-solar-600/40 bg-solar-600/[0.08] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-fg">
                    {skipped.length} not moved
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {skipped.slice(0, 6).map((s) => (
                      <li key={s.playerId} className="text-[12.5px] text-fg/72">
                        <span className="font-medium text-fg/88">{s.name}</span> — {s.reason}
                      </li>
                    ))}
                    {skipped.length > 6 && (
                      <li className="text-[12.5px] text-fg/58">
                        and {skipped.length - 6} more
                      </li>
                    )}
                  </ul>
                </div>
                <Button variant="ghost" size="sm" onClick={onDismissSkipped}>
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filters}
      {children}

      {/* Search + select-all */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search participants"
          />
        </div>
        {participants.length > 0 && (
          <Button variant="subtle" size="sm" onClick={togglePage}>
            {allOnPageSelected ? 'Clear this page' : `Select all ${participants.length}`}
          </Button>
        )}
        <span className="font-mono text-[12px] text-fg/58">
          {total} participant{total === 1 ? '' : 's'}
        </span>
      </div>

      {/* The list */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-fg/62">
          <Spinner size={18} />
          <span className="text-[13.5px]">Loading participants…</span>
        </div>
      ) : participants.length === 0 ? (
        <EmptyState glyph="◈" title={emptyTitle} description={emptyBody} />
      ) : (
        /* The action bar is sticky, so the last rows need somewhere to go
           or they sit permanently underneath it. */
        <ul
          className={clsx(
            'divide-y divide-fg/10 overflow-hidden rounded-xl border border-fg/14',
            selected.size > 0 && 'mb-20',
          )}
        >
          {participants.map((row, index) => {
            const isSelected = selected.has(row.playerId);
            const current = currentOf(row);
            return (
              <motion.li
                key={row.playerId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: DURATION.fast,
                  ease: EASE.smooth,
                  delay: Math.min(index * 0.015, 0.2),
                }}
                className={clsx(
                  'transition-colors',
                  isSelected ? 'bg-solar-500/[0.10]' : 'bg-fg/[0.02] hover:bg-fg/[0.05]',
                )}
              >
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 sm:px-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(row.playerId)}
                    disabled={!canEdit}
                    className="h-4 w-4 shrink-0 accent-solar-500"
                    aria-label={`Select ${row.name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-fg">
                      {row.name}
                    </span>
                    <span className="block truncate text-[12px] text-fg/62">
                      {detailOf ? detailOf(row) : row.email}
                    </span>
                  </span>
                  {current ? (
                    <Badge tone="info" glyph="◆">
                      {current}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" glyph="○">
                      Unassigned
                    </Badge>
                  )}
                </label>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* Action bar. Sticks to the bottom so the targets stay reachable from
          anywhere in a long list. */}
      <AnimatePresence>
        {selected.size > 0 && canEdit && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: DURATION.base, ease: EASE.luxe }}
            className="sticky bottom-4 z-10"
          >
            <div className="glass-strong flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl">
              <span className="text-[13.5px] font-semibold text-fg">
                {selected.size} selected
              </span>
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {targets.map((target) => (
                  <Button
                    key={target.id}
                    variant="solar"
                    size="sm"
                    loading={pending === target.id}
                    disabled={pending !== null}
                    onClick={() => void assign(target.id)}
                    title={target.hint}
                  >
                    Add to {target.label}
                  </Button>
                ))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
