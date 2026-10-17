import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { api, ApiError, type PlayerMaster, type TeamAllocation, type TeamMaster } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDebounced, useList, useMutation, useOptions } from '@/hooks/useResource';
import { ConfirmDialog } from '@/ui/Modal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorPanel,
  Field,
  Input,
  MailLink,
  PageHeader,
  Select,
  Spinner,
} from '@/ui/primitives';
import { DURATION, EASE, SPRING } from '@/lib/motion.js';
import { localIsoDate } from '@/lib/dates';
import { PlayerCard } from '../PlayerCard';

/**
 * Form 19 — TeamAllocation.
 *
 * Two panels: who is available on the left, who is in the squad on the right.
 * The rules the blueprint calls out are enforced by the server and surfaced
 * here before the user can trip over them:
 *
 *   - a player holds at most ONE active allocation per event
 *   - a team cannot exceed its configured capacity
 *   - only activated players in the same sub-group are eligible
 *
 * Allocation is by drag: drop an available player onto an occupied serial
 * number and the two trade places — the incoming player takes the slot, the
 * outgoing one returns to the eligible list. Dragging inside the squad
 * reorders it instead.
 *
 * The drag is hand-rolled on pointer events rather than framer's `drag`, and
 * the moving card is portalled to the body. Both panels scroll, so anything
 * dragged between them would otherwise be clipped at the first `overflow`
 * boundary it crossed.
 *
 * Every drag has a button alternative — WCAG 2.2 SC 2.5.7 requires one, and a
 * squad list is exactly the kind of thing people edit from a keyboard.
 */

type DragSource =
  | { kind: 'available'; player: PlayerMaster }
  | { kind: 'roster'; allocation: TeamAllocation; index: number };

type DropTarget =
  | { kind: 'slot'; index: number }
  | { kind: 'append' }
  | { kind: 'release' }
  | null;

interface DragState {
  source: DragSource;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  over: DropTarget;
}

const orderOf = (a: TeamAllocation) => a.sortOrder ?? a.allocationId;

const initials = (name = '?') =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

/* ------------------------------------------------------------------ *
 * Row chrome
 * ------------------------------------------------------------------ */

function Avatar({ name, color }: { name?: string; color?: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-fg/22 text-[12px] font-bold text-fg"
      style={{ background: `${color ?? '#4A4559'}33` }}
    >
      {initials(name)}
    </span>
  );
}

function GripDots() {
  return (
    <span aria-hidden="true" className="grid shrink-0 grid-cols-2 gap-[3px] px-0.5 text-fg/45">
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function AllocationPage() {
  const { scope, can } = useAuth();
  const toast = useToast();
  const reduceMotion = useReducedMotion();

  /* The team lives in the URL so the Teams list can link straight to a squad,
     and so a half-finished allocation survives a refresh. */
  const [params, setParams] = useSearchParams();
  const teamId = params.get('team') ?? '';
  const setTeamId = useCallback(
    (next: string) => {
      setParams(next ? { team: next } : {}, { replace: true });
    },
    [setParams],
  );

  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<TeamAllocation | null>(null);
  const [viewing, setViewing] = useState<PlayerMaster | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const debouncedSearch = useDebounced(search);

  const { options: teams, loading: teamsLoading } = useOptions<TeamMaster>(api.teams, {
    ...(scope.subGroupId ? { subGroupId: scope.subGroupId } : {}),
  });

  const team = useMemo(
    () => teams.find((t) => String(t.teamId) === teamId) ?? null,
    [teams, teamId],
  );

  const roster = useList(
    api.teamAllocations,
    { teamId: team?.teamId, isActive: true, pageSize: 100 },
    { enabled: Boolean(team) },
  );

  /* Everyone already allocated anywhere this season — they are not eligible. */
  const allAllocations = useList(
    api.teamAllocations,
    { isActive: true, eventId: team?.eventId, pageSize: 1000 },
    { enabled: Boolean(team) },
  );

  /* Activated players in this team's sub-group. */
  const candidates = useList(
    api.players,
    {
      subGroupId: team?.subGroupId,
      status: 'Active',
      isActive: true,
      pageSize: 500,
      search: debouncedSearch || undefined,
    },
    { enabled: Boolean(team) },
  );

  /* The squad is held locally as well as fetched, so a reorder paints
     immediately and reconciles when the writes land. */
  const [order, setOrder] = useState<TeamAllocation[]>([]);
  useEffect(() => {
    setOrder([...roster.items].sort((a, b) => orderOf(a) - orderOf(b)));
  }, [roster.items]);

  const orderRef = useRef<TeamAllocation[]>([]);
  orderRef.current = order;

  const takenPlayerIds = useMemo(
    () => new Set(allAllocations.items.map((a) => a.playerId)),
    [allAllocations.items],
  );

  const eligible = useMemo(
    () => candidates.items.filter((p) => !takenPlayerIds.has(p.playerId)),
    [candidates.items, takenPlayerIds],
  );

  /* Squad rows carry only a denormalised playerName, so the full record for
     the card comes from the candidate pool. */
  const playerById = useMemo(
    () => new Map(candidates.items.map((p) => [p.playerId, p])),
    [candidates.items],
  );

  const capacity = team?.maxPlayers ?? 0;
  const filled = order.length;
  const isFull = team ? filled >= capacity : false;
  const canEdit = can('allocation', 'create');

  const refreshAll = useCallback(() => {
    roster.refresh();
    allAllocations.refresh();
    candidates.refresh();
  }, [roster, allAllocations, candidates]);

  /* ---------------- drop-zone registry ---------------- */

  const slotRefs = useRef(new Map<number, HTMLElement>());
  const appendRef = useRef<HTMLDivElement | null>(null);
  const availableRef = useRef<HTMLDivElement | null>(null);

  const registerSlot = useCallback((index: number, el: HTMLElement | null) => {
    if (el) slotRefs.current.set(index, el);
    else slotRefs.current.delete(index);
  }, []);

  const locate = useCallback((x: number, y: number): DropTarget => {
    const hit = (el: Element | null | undefined) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    for (const [index, el] of slotRefs.current) {
      if (hit(el)) return { kind: 'slot', index };
    }
    if (hit(appendRef.current)) return { kind: 'append' };
    if (hit(availableRef.current)) return { kind: 'release' };
    return null;
  }, []);

  /* ---------------- writes ---------------- */

  const allocate = useMutation(async (player: PlayerMaster) => {
    if (!team) throw new ApiError('Choose a team first.', 400);
    return api.teamAllocations.create({
      playerId: player.playerId,
      teamId: team.teamId,
      eventId: team.eventId,
      allocationDate: localIsoDate(),
      sortOrder: orderRef.current.length + 1,
      isActive: true,
    });
  });

  const release = useMutation(async (allocation: TeamAllocation) =>
    api.teamAllocations.deactivate(allocation.allocationId),
  );

  const onAllocate = useCallback(
    async (player: PlayerMaster) => {
      if (!team) return;
      try {
        await allocate.run(player);
        toast.success(`${player.name} allocated`, `${team.teamName} · ${filled + 1} of ${capacity}`);
        refreshAll();
      } catch (cause) {
        toast.error('Allocation refused', cause instanceof ApiError ? cause.message : undefined);
      }
    },
    [team, allocate, toast, filled, capacity, refreshAll],
  );

  /**
   * Trade an eligible player for one already in the squad.
   *
   * Release first, then allocate. The reverse order trips the capacity check
   * on a full team, which is exactly the case a swap exists for. If the second
   * call fails the first is undone, so a refused swap leaves the squad as it
   * was rather than a player short.
   */
  const swapIn = useCallback(
    async (player: PlayerMaster, index: number) => {
      const outgoing = orderRef.current[index];
      if (!team || !outgoing) return;

      setBusySlot(index);
      try {
        await api.teamAllocations.deactivate(outgoing.allocationId);
        try {
          await api.teamAllocations.create({
            playerId: player.playerId,
            teamId: team.teamId,
            eventId: team.eventId,
            allocationDate: localIsoDate(),
            sortOrder: outgoing.sortOrder ?? index + 1,
            jerseyNo: outgoing.jerseyNo ?? null,
            isActive: true,
          });
        } catch (cause) {
          await api.teamAllocations.update(outgoing.allocationId, { isActive: true });
          throw cause;
        }
        toast.success(
          `${player.name} in, ${outgoing.playerName} out`,
          `Position ${index + 1} · ${outgoing.playerName} is eligible again.`,
        );
        refreshAll();
      } catch (cause) {
        toast.error('Swap refused', cause instanceof ApiError ? cause.message : undefined);
      } finally {
        setBusySlot(null);
      }
    },
    [team, toast, refreshAll],
  );

  /** Renumber the squad. Only rows whose position actually moved are written. */
  const persistOrder = useCallback(
    async (next: TeamAllocation[]) => {
      const moved = next.filter((a, index) => orderOf(a) !== index + 1);
      if (!moved.length) return;
      try {
        await Promise.all(
          moved.map((a) =>
            api.teamAllocations.update(a.allocationId, {
              sortOrder: next.findIndex((n) => n.allocationId === a.allocationId) + 1,
            }),
          ),
        );
      } catch (cause) {
        toast.error(
          'Could not save the new order',
          cause instanceof ApiError ? cause.message : undefined,
        );
      } finally {
        roster.refresh();
      }
    },
    [roster, toast],
  );

  const reorder = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = [...orderRef.current];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      setOrder(next);
      void persistOrder(next);
    },
    [persistOrder],
  );

  const onRelease = async () => {
    if (!removing) return;
    try {
      await release.run(removing);
      toast.success(`${removing.playerName} released`, 'They can now be allocated to another team.');
      setRemoving(null);
      refreshAll();
    } catch (cause) {
      toast.error('Could not release', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  /* ---------------- drag ---------------- */

  const commit = useCallback(
    (source: DragSource, target: DropTarget) => {
      if (!target) return;

      if (source.kind === 'available') {
        if (target.kind === 'slot') {
          void swapIn(source.player, target.index);
        } else if (target.kind === 'append') {
          if (isFull) {
            toast.error('Squad is full', 'Drop onto a numbered row to swap someone out instead.');
          } else {
            void onAllocate(source.player);
          }
        }
        return;
      }

      if (target.kind === 'slot') reorder(source.index, target.index);
      else if (target.kind === 'append') reorder(source.index, orderRef.current.length - 1);
      else if (target.kind === 'release') setRemoving(source.allocation);
    },
    [swapIn, onAllocate, reorder, isFull, toast],
  );

  const dragTeardown = useRef<(() => void) | null>(null);

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, source: DragSource) => {
      if (!canEdit || busySlot !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      /* Let the name button, the mail link and the row buttons behave normally. */
      if ((event.target as HTMLElement).closest('a, button')) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;
      let live = false;

      const move = (e: PointerEvent) => {
        /* A few pixels of slack, so a click stays a click. */
        if (!live && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
        live = true;
        setDrag({
          source,
          x: e.clientX,
          y: e.clientY,
          offsetX,
          offsetY,
          width: rect.width,
          over: locate(e.clientX, e.clientY),
        });
      };

      const teardown = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        document.body.style.userSelect = '';
        dragTeardown.current = null;
      };

      const finish = (e: PointerEvent) => {
        teardown();
        if (live) commit(source, locate(e.clientX, e.clientY));
        setDrag(null);
      };

      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
      dragTeardown.current = teardown;
    },
    [canEdit, busySlot, locate, commit],
  );

  /* A drag interrupted by an unmount must not leave listeners behind that commit a write later. */
  useEffect(() => () => dragTeardown.current?.(), []);

  const dragging = drag?.source;
  const draggingAvailableId = dragging?.kind === 'available' ? dragging.player.playerId : null;
  const draggingRosterIndex = dragging?.kind === 'roster' ? dragging.index : null;
  const dragName =
    dragging?.kind === 'available' ? dragging.player.name : dragging?.allocation.playerName;

  /* ---------------- render ---------------- */

  return (
    <>
      <PageHeader
        eyebrow="Competition"
        title="Team allocation"
        description="Drag a participant onto a numbered slot to swap them in, or drag within the squad to reorder it. A participant may hold only one active allocation per season."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Team" htmlFor="alloc-team" required className="w-full sm:w-72">
          <Select
            id="alloc-team"
            value={teamId}
            placeholder={teamsLoading ? 'Loading teams…' : 'Choose a team'}
            disabled={teamsLoading}
            onChange={(event) => setTeamId(event.target.value)}
          >
            {teams.map((t) => (
              <option key={t.teamId} value={String(t.teamId)}>
                {t.subGroupName} — {t.teamName}
              </option>
            ))}
          </Select>
        </Field>

        {team && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: DURATION.fast }}
            className="flex items-center gap-2 pb-1"
          >
            <Badge tone={isFull ? 'success' : 'warning'} glyph={isFull ? '●' : '◐'}>
              {filled} / {capacity} {isFull ? 'full' : 'allocated'}
            </Badge>
            {isFull && (
              <span className="text-[12.5px] text-fg/68">
                Drop onto a slot to swap someone out.
              </span>
            )}
          </motion.div>
        )}
      </div>

      {!team ? (
        <div className="glass rounded-2xl">
          <EmptyState
            glyph="⇄"
            title="Choose a team to begin"
            description="Pick a team above. You will then see every eligible participant on the left and the current squad on the right."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---------- Eligible ---------- */}
          <Card
            title={`Eligible players (${eligible.length})`}
            action={
              <span className="text-[12px] text-fg/62">{team.subGroupName} · activated only</span>
            }
          >
            <div className="mb-3">
              <Input
                type="search"
                value={search}
                placeholder="Search by name, email or department…"
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search eligible participants"
              />
            </div>

            {candidates.error && (
              <ErrorPanel message={candidates.error.message} onRetry={candidates.refresh} />
            )}

            <div
              ref={availableRef}
              className={clsx(
                'rounded-xl transition-colors duration-200',
                draggingRosterIndex !== null &&
                  'bg-magenta-500/[0.08] outline-dashed outline-2 outline-offset-2 outline-magenta-400/70',
              )}
            >
              {draggingRosterIndex !== null && (
                <p className="px-2 pt-2 text-center text-[12.5px] font-semibold text-accent-magenta">
                  Drop here to release from the squad
                </p>
              )}

              {candidates.loading ? (
                <div className="flex items-center justify-center gap-2.5 py-10 text-fg/62">
                  <Spinner size={16} />
                  <span className="text-[13.5px]">Loading players…</span>
                </div>
              ) : eligible.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] leading-relaxed text-fg/68">
                  {debouncedSearch
                    ? 'No eligible participant matches that search.'
                    : 'Every activated participant in this sub-group already holds an allocation.'}
                </p>
              ) : (
                <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto p-1">
                  <AnimatePresence initial={false}>
                    {eligible.map((player) => (
                      <motion.li
                        key={player.playerId}
                        layout={!drag && !reduceMotion}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{
                          opacity: draggingAvailableId === player.playerId ? 0.35 : 1,
                          y: 0,
                        }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: DURATION.fast, ease: EASE.luxe }}
                        className={clsx(
                          'lift flex items-center gap-2.5 rounded-xl border border-fg/14 bg-fg/[0.04] p-2.5',
                          canEdit && 'cursor-grab active:cursor-grabbing',
                        )}
                        style={{ touchAction: canEdit ? 'none' : undefined }}
                        onPointerDown={(event) => beginDrag(event, { kind: 'available', player })}
                      >
                        {canEdit && <GripDots />}
                        <Avatar name={player.name} color={team.colorHex} />

                        <span className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setViewing(player)}
                            className="block max-w-full truncate text-left text-[14px] font-semibold text-fg underline-offset-4 hover:underline coarse:-my-2.5 coarse:py-2.5"
                          >
                            {player.name}
                          </button>
                          <span className="block truncate text-[12px]">
                            <MailLink email={player.email} />
                          </span>
                          <span className="block truncate text-[12px] text-fg/62">
                            {[player.playerSubTypeName, player.playerSubTypeDetailName, player.department]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>

                        {canEdit && (
                          <Button
                            variant="subtle"
                            size="sm"
                            disabled={isFull || allocate.saving}
                            title={isFull ? 'Squad is full — drag onto a slot to swap' : 'Add to squad'}
                            onClick={() => void onAllocate(player)}
                          >
                            Add →
                          </Button>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </Card>

          {/* ---------- Squad ---------- */}
          <Card
            title={`${team.teamName} squad (${filled})`}
            action={
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-sm border border-fg/26"
                style={{ background: team.colorHex ?? 'transparent' }}
              />
            }
          >
            {roster.error && <ErrorPanel message={roster.error.message} onRetry={roster.refresh} />}

            {roster.loading && !order.length ? (
              <div className="flex items-center justify-center gap-2.5 py-10 text-fg/62">
                <Spinner size={16} />
                <span className="text-[13.5px]">Loading squad…</span>
              </div>
            ) : order.length === 0 ? (
              <p className="py-10 text-center text-[13.5px] text-fg/68">
                No players allocated yet. Drag one across from the left.
              </p>
            ) : (
              <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto p-1">
                {order.map((allocation, index) => {
                  const targeted = drag?.over?.kind === 'slot' && drag.over.index === index;
                  const incoming = targeted && dragging?.kind === 'available';
                  const player = playerById.get(allocation.playerId);

                  return (
                    <motion.li
                      key={allocation.allocationId}
                      ref={(el) => registerSlot(index, el)}
                      layout={!drag && !reduceMotion}
                      transition={reduceMotion ? { duration: 0 } : SPRING.settle}
                      animate={{
                        opacity: draggingRosterIndex === index ? 0.35 : 1,
                        scale: targeted ? 1.015 : 1,
                      }}
                      className={clsx(
                        'relative flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors duration-200',
                        targeted
                          ? incoming
                            ? 'border-solar-400 bg-solar-500/[0.14]'
                            : 'border-azure-400 bg-azure-500/[0.14]'
                          : 'lift border-fg/14 bg-fg/[0.04]',
                        canEdit && 'cursor-grab active:cursor-grabbing',
                      )}
                      style={{ touchAction: canEdit ? 'none' : undefined }}
                      onPointerDown={(event) =>
                        beginDrag(event, { kind: 'roster', allocation, index })
                      }
                    >
                      <span
                        className={clsx(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[12px] font-bold',
                          targeted ? 'bg-solar-500 text-ink-900' : 'bg-fg/[0.08] text-fg/72',
                        )}
                      >
                        {index + 1}
                      </span>

                      <Avatar name={allocation.playerName} color={team.colorHex} />

                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          disabled={!player}
                          onClick={() => player && setViewing(player)}
                          className="block max-w-full truncate text-left text-[14px] font-semibold text-fg underline-offset-4 hover:underline coarse:-my-2.5 coarse:py-2.5 disabled:no-underline"
                        >
                          {allocation.playerName}
                        </button>
                        {player?.email && (
                          <span className="block truncate text-[12px]">
                            <MailLink email={player.email} />
                          </span>
                        )}
                        <span className="block text-[12px] text-fg/62">
                          Allocated {allocation.allocationDate}
                          {allocation.jerseyNo ? ` · #${allocation.jerseyNo}` : ''}
                        </span>
                      </span>

                      {canEdit && (
                        <span className="flex shrink-0 items-center gap-1">
                          {/* Keyboard path for the reorder that dragging performs. */}
                          <button
                            type="button"
                            aria-label={`Move ${allocation.playerName} up`}
                            disabled={index === 0}
                            onClick={() => reorder(index, index - 1)}
                            className="grid h-6 w-6 place-items-center rounded-md coarse:h-9 coarse:w-9 text-fg/68 transition-colors hover:bg-fg/12 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${allocation.playerName} down`}
                            disabled={index === order.length - 1}
                            onClick={() => reorder(index, index + 1)}
                            className="grid h-6 w-6 place-items-center rounded-md coarse:h-9 coarse:w-9 text-fg/68 transition-colors hover:bg-fg/12 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            ↓
                          </button>
                          <Button variant="danger" size="sm" onClick={() => setRemoving(allocation)}>
                            Release
                          </Button>
                        </span>
                      )}

                      {incoming && (
                        <span className="pointer-events-none absolute -top-2 left-10 z-10 rounded-full bg-solar-500 px-2 py-0.5 text-[11px] font-bold text-ink-900 shadow-lg">
                          Swap with {allocation.playerName}
                        </span>
                      )}

                      {busySlot === index && (
                        <span className="absolute inset-0 grid place-items-center rounded-xl bg-surface/70 backdrop-blur-sm">
                          <Spinner size={18} />
                        </span>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            )}

            {/* Tail drop zone — plain append, and the reorder-to-last target. */}
            {canEdit && (
              <div
                ref={appendRef}
                className={clsx(
                  'mt-2 rounded-xl border-2 border-dashed px-4 py-3 text-center text-[12.5px] transition-colors duration-200',
                  drag?.over?.kind === 'append'
                    ? 'border-solar-400 bg-solar-500/[0.12] text-solar-100'
                    : drag
                      ? 'border-fg/26 text-fg/68'
                      : 'border-fg/16 text-fg/58',
                )}
              >
                {isFull && dragging?.kind === 'available'
                  ? 'Squad is full — drop onto a numbered slot to swap'
                  : 'Drop here to add to the end of the squad'}
              </div>
            )}

            <div className="mt-4 border-t border-fg/14 pt-3">
              <div className="mb-1.5 flex items-center justify-between text-[12px] text-fg/68">
                <span>Capacity</span>
                <span className="tabular-nums">
                  {filled} of {capacity}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-fg/12">
                <motion.div
                  animate={{ width: `${capacity ? Math.min(filled / capacity, 1) * 100 : 0}%` }}
                  transition={{ duration: DURATION.base, ease: EASE.luxe }}
                  className="h-full rounded-full"
                  style={{ background: isFull ? '#00A170' : '#D9AC00' }}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ---------- The card under the cursor ---------- */}
      {drag &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              /* Clamped to the viewport. The card is as wide as the row it came
                 from, so following the cursor unclamped pushes it off-screen
                 whenever the drop target is near the right edge. */
              left: Math.max(8, Math.min(drag.x - drag.offsetX, window.innerWidth - drag.width - 8)),
              top: Math.max(8, drag.y - drag.offsetY),
              width: drag.width,
              pointerEvents: 'none',
              zIndex: 70,
            }}
            className="rotate-[1.5deg] rounded-xl border border-solar-400/70 bg-surface-raised p-2.5 shadow-2xl shadow-black/60"
          >
            <span className="flex items-center gap-2.5">
              <Avatar name={dragName} color={team?.colorHex} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-fg">{dragName}</span>
                <span className="block truncate text-[12px] text-accent-solar">
                  {drag.over?.kind === 'slot'
                    ? `→ position ${drag.over.index + 1}`
                    : drag.over?.kind === 'append'
                      ? '→ end of squad'
                      : drag.over?.kind === 'release'
                        ? '→ release from squad'
                        : 'Drop on a slot…'}
                </span>
              </span>
            </span>
          </div>,
          document.body,
        )}

      <PlayerCard
        player={viewing}
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        accentColor={team?.colorHex}
        note={
          viewing && takenPlayerIds.has(viewing.playerId)
            ? 'Already allocated this season. Release them from their current squad before allocating again.'
            : undefined
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
              Close
            </Button>
            {canEdit && viewing && team && !takenPlayerIds.has(viewing.playerId) && (
              <Button
                variant="solar"
                size="sm"
                disabled={isFull}
                loading={allocate.saving}
                title={isFull ? 'Squad is full — swap someone out instead' : undefined}
                onClick={() => {
                  const player = viewing;
                  setViewing(null);
                  void onAllocate(player);
                }}
              >
                Add to {team.teamName}
              </Button>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onCancel={() => setRemoving(null)}
        onConfirm={() => void onRelease()}
        loading={release.saving}
        title="Release this participant?"
        confirmLabel="Release"
        message={
          <>
            <p>
              <strong className="text-fg">{removing?.playerName}</strong> will be removed from{' '}
              {team?.teamName} and becomes eligible for another team.
            </p>
            <p className="mt-2 text-fg/68">
              The allocation row is kept and flagged inactive, so the history of who played where is
              preserved.
            </p>
          </>
        }
      />
    </>
  );
}
