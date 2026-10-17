import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  api,
  ApiError,
  type PlayerMaster,
  type TeamAllocation,
  type TeamFormation,
  type TeamMaster,
} from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useList, useOptions } from '@/hooks/useResource';
import { Badge, Button, EmptyState, ErrorPanel, Field, Input, Select, Spinner } from '@/ui/primitives';
import { SportBanner } from '../SportBanner';
import { DURATION, EASE } from '@/lib/motion.js';
import { localIsoDate } from '@/lib/dates';
import { layoutSlots, sportOf, type StadiumSlot } from '../stadiumLayout';

/* three.js is the heaviest thing in the app. The layout maths is imported
   eagerly from stadiumLayout (no three), and only the renderer is lazy — so
   the page shell and the available list paint while the scene streams in. */
const StadiumScene = lazy(() =>
  import('../StadiumScene').then((m) => ({ default: m.StadiumScene })),
);

/**
 * The squad builder.
 *
 * Left: everyone eligible for this team, grouped by the type they were
 * classified as. Right: the pitch, with one chip per slot the formation
 * allows. Drag a card onto a chip to allocate.
 *
 * Allocation writes ordinary TeamAllocation rows — the same table the older
 * allocation screen uses — so the two screens are two views of one truth
 * rather than parallel systems. Which chip a participant occupies is positional:
 * the Nth allocated participant of a type sits in that type's Nth slot. That
 * avoids inventing a slot column for something the formation already implies.
 */

export function TeamBuilderPage() {
  const { can, scope } = useAuth();
  const toast = useToast();

  const [params, setParams] = useSearchParams();
  const teamId = params.get('team') ?? '';
  const setTeamId = (next: string) => setParams(next ? { team: next } : {}, { replace: true });

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{
    rows: PlayerMaster[];
    fromSlot: string | null;
    x: number;
    y: number;
    over: string | null;
  } | null>(null);

  const canEdit = can('teamBuilder', 'edit');
  const zones = useRef(new Map<string, HTMLElement>());

  const registerZone = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) zones.current.set(key, el);
      else zones.current.delete(key);
    },
    [],
  );

  const locate = useCallback((x: number, y: number): string | null => {
    for (const [key, el] of zones.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  }, []);

  /* ---- data ---- */
  const { options: teams } = useOptions<TeamMaster>(api.teams, {
    ...(scope.subGroupId ? { subGroupId: scope.subGroupId } : {}),
  });
  const team = teams.find((t) => String(t.teamId) === teamId) ?? null;

  const { options: formations } = useOptions<TeamFormation>(
    api.formations,
    { subGroupId: team?.subGroupId },
    { enabled: Boolean(team) },
  );
  const formation = formations.find((f) => f.formationId === team?.formationId) ?? null;

  const roster = useList<TeamAllocation>(
    api.teamAllocations,
    { teamId: team?.teamId, isActive: true, pageSize: 100 },
    { enabled: Boolean(team) },
  );

  const population = useList<PlayerMaster>(
    api.players,
    {
      subGroupId: team?.subGroupId,
      isActive: true,
      status: 'Active',
      pageSize: 500,
      sortBy: 'name',
      sortDir: 'asc',
    },
    { enabled: Boolean(team) },
  );

  /* ---- derived ---- */
  const allocatedIds = useMemo(
    () => new Set(roster.items.map((a) => a.playerId)),
    [roster.items],
  );

  const byId = useMemo(
    () => new Map(population.items.map((p) => [p.playerId, p])),
    [population.items],
  );

  /** Who is on the pitch, in allocation order, grouped by their type. */
  const occupantsByType = useMemo(() => {
    const map = new Map<number, { playerId: number; name: string }[]>();
    const ordered = [...roster.items].sort(
      (a, b) => (a.sortOrder ?? a.allocationId) - (b.sortOrder ?? b.allocationId),
    );
    for (const allocation of ordered) {
      const player = byId.get(allocation.playerId);
      if (!player?.playerSubTypeId) continue;
      const list = map.get(player.playerSubTypeId) ?? [];
      list.push({ playerId: player.playerId, name: player.name });
      map.set(player.playerSubTypeId, list);
    }
    return map;
  }, [roster.items, byId]);

  const slots: StadiumSlot[] = useMemo(
    () => (formation ? layoutSlots(formation.slots ?? [], occupantsByType) : []),
    [formation, occupantsByType],
  );

  /** Eligible = right sub-group, classified, not already on a team. */
  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return population.items.filter((p) => {
      if (allocatedIds.has(p.playerId)) return false;
      if (!p.playerSubTypeId) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.department ?? '').toLowerCase().includes(term) ||
        (p.playerSubTypeName ?? '').toLowerCase().includes(term)
      );
    });
  }, [population.items, allocatedIds, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlayerMaster[]>();
    for (const p of available) {
      const key = p.playerSubTypeName ?? 'Unclassified';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [available]);

  const refreshAll = () => {
    roster.refresh();
    population.refresh();
  };

  /* ---- writes ---- */
  const allocate = async (players: PlayerMaster[], slot: StadiumSlot) => {
    /* The chip says which type it wants; refuse the mismatch here so the
       message names the slot rather than echoing a server constraint. */
    const wrong = players.find((p) => Number(p.playerSubTypeId) !== slot.playerSubTypeId);
    if (wrong) {
      toast.error(
        `${wrong.name} is a ${wrong.playerSubTypeName ?? 'different type'}`,
        `That slot is for a ${slot.typeName}.`,
      );
      return;
    }

    setBusy(true);
    try {
      for (const player of players) {
        await api.teamAllocations.create({
          playerId: player.playerId,
          teamId: team!.teamId,
          eventId: team!.eventId,
          allocationDate: localIsoDate(),
        });
      }
      toast.success(
        `${players.length} participant${players.length === 1 ? '' : 's'} added to ${team!.teamName}`,
      );
      setSelected(new Set());
      refreshAll();
    } catch (cause) {
      toast.error(
        'Could not allocate',
        cause instanceof ApiError ? cause.message : 'Unexpected error.',
      );
      refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const release = async (slot: StadiumSlot) => {
    if (!slot.occupant) return;
    const allocation = roster.items.find((a) => a.playerId === slot.occupant!.playerId);
    if (!allocation) return;

    setBusy(true);
    try {
      await api.teamAllocations.deactivate(allocation.allocationId);
      toast.info(`${slot.occupant.name} released`, 'They are available again.');
      refreshAll();
    } catch (cause) {
      toast.error('Could not release', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  /* ---- drag ---- */
  const dragTeardown = useRef<(() => void) | null>(null);
  useEffect(() => () => dragTeardown.current?.(), []);

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, rows: PlayerMaster[], fromSlot: string | null) => {
      if (!canEdit || busy) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const startX = event.clientX;
      const startY = event.clientY;
      let live = false;

      const move = (e: PointerEvent) => {
        if (!live) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
          live = true;
          document.body.style.userSelect = 'none';
        }
        setDrag({ rows, fromSlot, x: e.clientX, y: e.clientY, over: locate(e.clientX, e.clientY) });
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

        if (live) {
          const swallow = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
          };
          window.addEventListener('click', swallow, { capture: true, once: true });
          window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 300);

          const key = locate(e.clientX, e.clientY);
          const target = key ? slots.find((s) => s.key === key) : null;
          if (target && key !== fromSlot) {
            if (target.occupant) {
              toast.error('That slot is taken', `Remove ${target.occupant.name} first.`);
            } else {
              void allocate(rows, target);
            }
          }
        }
        setDrag(null);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
      dragTeardown.current = teardown;
    },
    [canEdit, busy, locate, slots, team],
  );

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedRows = useMemo(
    () => available.filter((p) => selected.has(p.playerId)),
    [available, selected],
  );

  /* ---- fill summary ---- */
  const summary = useMemo(() => {
    if (!formation) return null;
    const filled = roster.items.length;
    const short = filled < formation.minPlayers;
    const perType = (formation.slots ?? []).map((s) => ({
      name: s.playerSubTypeName ?? `#${s.playerSubTypeId}`,
      have: (occupantsByType.get(s.playerSubTypeId) ?? []).length,
      min: s.min,
      max: s.max,
    }));
    return { filled, short, perType };
  }, [formation, roster.items.length, occupantsByType]);

  return (
    <>
      {/* The banner picks up the chosen team's sport, so the page announces
          which competition you are building for before you read a word. */}
      <SportBanner
        subGroupName={team?.subGroupName}
        eyebrow="Competition"
        title="Team builder"
        description="Drag a participant onto a slot to put them in the side. The pitch shows exactly the places the team's formation allows."
        actions={
          team?.subGroupName ? (
            <Badge tone="info" glyph="◆">
              {team.subGroupName}
            </Badge>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Team" htmlFor="builder-team" required className="w-full sm:w-72">
          <Select
            id="builder-team"
            value={teamId}
            placeholder="Choose a team"
            onChange={(event) => {
              setTeamId(event.target.value);
              setSelected(new Set());
            }}
          >
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName} — {t.subGroupName}
              </option>
            ))}
          </Select>
        </Field>

        {team && summary && (
          <div className="flex flex-wrap items-center gap-2 pb-2.5">
            <Badge tone={summary.short ? 'warning' : 'success'} glyph={summary.short ? '◐' : '●'}>
              {summary.filled} / {formation?.maxPlayers ?? team.maxPlayers}
              {summary.short ? ` · short of ${formation?.minPlayers}` : ' · complete'}
            </Badge>
            {summary.perType.map((t) => (
              <Badge
                key={t.name}
                tone={t.have < t.min ? 'warning' : t.have >= t.max ? 'info' : 'neutral'}
                glyph="◆"
              >
                {t.name} {t.have}/{t.max}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {!team ? (
        <EmptyState
          glyph="⬢"
          title="Choose a team"
          description="Pick a side above and its pitch appears, with a slot for every place the formation allows."
        />
      ) : !team.formationId || !formation ? (
        <EmptyState
          glyph="⬡"
          title={`${team.teamName} has no formation`}
          description="A squad needs a shape before it can be built. Set one on the Teams screen, or create a formation first."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,320px)_1fr]">
          {/* Available */}
          <section className="rounded-2xl border border-fg/14 bg-fg/[0.02] p-3">
            <header className="mb-2.5 flex items-baseline justify-between gap-2 px-1">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg/72">
                Available
              </h2>
              <span className="font-mono text-[11.5px] text-fg/58">{available.length}</span>
            </header>

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, type or department…"
              aria-label="Search available participants"
            />

            {selected.size > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="warning" glyph="◆">
                  {selected.size} selected
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            )}

            {population.loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-fg/62">
                <Spinner size={16} />
                <span className="text-[13px]">Loading…</span>
              </div>
            ) : available.length === 0 ? (
              <p className="px-1 py-8 text-center text-[12.5px] leading-relaxed text-fg/58">
                Nobody eligible is left. Everyone classified in this sub-group already holds an
                allocation.
              </p>
            ) : (
              <div className="mt-3 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {grouped.map(([typeName, rows]) => (
                  <div key={typeName}>
                    <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-fg/52">
                      {typeName} · {rows.length}
                    </p>
                    <ul className="space-y-1.5">
                      {rows.map((row) => {
                        const isSelected = selected.has(row.playerId);
                        return (
                          <motion.li
                            key={row.playerId}
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: DURATION.fast, ease: EASE.smooth }}
                            role="button"
                            tabIndex={canEdit ? 0 : -1}
                            aria-pressed={isSelected}
                            onPointerDown={(event) =>
                              beginDrag(event, isSelected && selected.size > 1 ? selectedRows : [row], null)
                            }
                            onClick={() => canEdit && toggle(row.playerId)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                if (canEdit) toggle(row.playerId);
                              }
                            }}
                            style={{ touchAction: canEdit ? 'none' : undefined }}
                            className={clsx(
                              'select-none rounded-lg border px-2.5 py-2 transition-colors',
                              isSelected
                                ? 'border-solar-500/60 bg-solar-500/[0.14]'
                                : 'border-fg/12 bg-fg/[0.04] hover:border-fg/24',
                              canEdit && 'cursor-grab active:cursor-grabbing',
                            )}
                          >
                            <span className="block truncate text-[13px] font-medium text-fg">
                              {row.name}
                            </span>
                            <span className="block truncate text-[11.5px] text-fg/58">
                              {row.playerSubTypeDetailName
                                ? `${row.playerSubTypeDetailName} · ${row.department ?? ''}`
                                : row.department || row.email}
                            </span>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pitch */}
          <section className="relative min-h-[520px] overflow-hidden rounded-2xl border border-fg/14 bg-ink-900">
            {roster.error && (
              <div className="p-4">
                <ErrorPanel message={roster.error.message} onRetry={refreshAll} />
              </div>
            )}

            <Suspense
              fallback={
                <div className="flex h-[520px] items-center justify-center gap-3 text-white/62">
                  <Spinner size={18} />
                  <span className="text-[13.5px]">Building the pitch…</span>
                </div>
              }
            >
              <div className="h-[520px] w-full xl:h-[640px]">
                <StadiumScene
                  sport={sportOf(team.subGroupName)}
                  slots={slots}
                  overKey={drag?.over ?? null}
                  canEdit={canEdit}
                  selectedCount={selected.size}
                  registerZone={registerZone}
                  onPickUp={(event, slot) => {
                    const player = slot.occupant ? byId.get(slot.occupant.playerId) : null;
                    if (player) beginDrag(event, [player], slot.key);
                  }}
                  onPlaceSelected={(slot) => void allocate(selectedRows, slot)}
                  onClear={(slot) => void release(slot)}
                />
              </div>
            </Suspense>

            <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/80 px-3 py-1 text-[11.5px] text-white/70 backdrop-blur">
              Drag onto a slot · drag the turf to orbit
            </p>
          </section>
        </div>
      )}

      {/* The card that follows the cursor. */}
      {drag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80] rounded-lg border border-solar-400 bg-surface-raised px-2.5 py-2 shadow-2xl"
            style={{ left: drag.x + 12, top: drag.y + 12, transform: 'rotate(1.5deg)' }}
          >
            <span className="block truncate text-[13px] font-medium text-fg">
              {drag.rows[0]!.name}
            </span>
            {drag.rows.length > 1 && (
              <span className="block text-[11.5px] text-accent-solar">
                +{drag.rows.length - 1} more
              </span>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
