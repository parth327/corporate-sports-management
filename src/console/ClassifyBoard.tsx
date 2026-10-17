import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import type { PlayerMaster } from '@/api';
import { Badge, Button, EmptyState, Input, Spinner } from '@/ui/primitives';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * Two-panel classifier: an unassigned column on the left, a set of buckets on
 * the right, and drag between them.
 *
 * The drag is hand-rolled on pointer events rather than framer's `drag`, for
 * the same reason the allocation screen does it: both panels scroll, and a
 * card dragged between them would otherwise be clipped at the first
 * `overflow` boundary it crossed. The moving card is portalled to the body and
 * is `pointer-events: none`, which also keeps it from swallowing the hit test.
 *
 * Hit testing is rect-based against a ref map rather than `elementFromPoint`,
 * because the floating card sits under the cursor for the whole gesture.
 *
 * Every drag has a pointer-free equivalent — WCAG 2.2 SC 2.5.7 requires one,
 * and bulk classification is exactly the kind of job people do from the
 * keyboard. Clicking a card selects it; selected cards can be sent to any
 * bucket with that bucket's button. Dragging is the shortcut, not the only way.
 */

export interface Bucket {
  id: number;
  label: string;
  hint?: string;
  members: PlayerMaster[];
}

/** `null` means the unassigned column. */
export type ZoneId = number | null;

interface ClassifyBoardProps {
  sourceLabel: string;
  sourceHint: string;
  source: PlayerMaster[];
  buckets: Bucket[];
  onMove: (playerIds: number[], to: ZoneId) => Promise<void>;
  canEdit: boolean;
  loading: boolean;
  busy: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  /** Shown in place of the whole board until the filters above are satisfied. */
  gate?: { title: string; body: string } | null;
}

export function ClassifyBoard({
  sourceLabel,
  sourceHint,
  source,
  buckets,
  onMove,
  canEdit,
  loading,
  busy,
  search,
  onSearchChange,
  gate,
}: ClassifyBoardProps) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<{
    rows: PlayerMaster[];
    from: ZoneId;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
    width: number;
    over: ZoneId | undefined;
  } | null>(null);

  const zones = useRef(new Map<string, HTMLElement>());
  const registerZone = (id: ZoneId) => (el: HTMLElement | null) => {
    const key = id === null ? 'source' : String(id);
    if (el) zones.current.set(key, el);
    else zones.current.delete(key);
  };

  const locate = useCallback((x: number, y: number): ZoneId | undefined => {
    for (const [key, el] of zones.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return key === 'source' ? null : Number(key);
      }
    }
    return undefined;
  }, []);

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clear = () => setSelected(new Set());

  const move = async (ids: number[], to: ZoneId) => {
    if (!ids.length) return;
    await onMove(ids, to);
    clear();
  };

  const dragTeardown = useRef<(() => void) | null>(null);
  useEffect(() => () => dragTeardown.current?.(), []);

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, row: PlayerMaster, from: ZoneId) => {
      if (!canEdit || busy) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;
      const width = rect.width;

      /* Dragging a card that is part of a multi-selection carries the whole
         selection; dragging an unselected one carries just that card. */
      const rows =
        selected.has(row.playerId) && selected.size > 1
          ? [...source, ...buckets.flatMap((b) => b.members)].filter((p) =>
              selected.has(p.playerId),
            )
          : [row];

      let live = false;

      const onMoveEvent = (e: PointerEvent) => {
        if (!live) {
          /* Threshold, so a click to select is never mistaken for a drag. */
          if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
          live = true;
          document.body.style.userSelect = 'none';
        }
        setDrag({
          rows,
          from,
          x: e.clientX,
          y: e.clientY,
          offsetX,
          offsetY,
          width,
          over: locate(e.clientX, e.clientY),
        });
      };

      const teardown = () => {
        window.removeEventListener('pointermove', onMoveEvent);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        document.body.style.userSelect = '';
        dragTeardown.current = null;
      };

      const finish = (e: PointerEvent) => {
        teardown();

        /* Selection is handled by the click that follows, not here — that way
           a synthetic click (which carries no pointer events, and is what
           some assistive tech dispatches) still selects.

           A real drag ends with the browser firing a click on the card, which
           would then toggle it. Swallow exactly that one click at the capture
           phase; the timeout removes the trap if no click ever arrives, so it
           can never go stale and eat a later, genuine one. */
        if (live) {
          const swallow = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
          };
          window.addEventListener('click', swallow, { capture: true, once: true });
          window.setTimeout(
            () => window.removeEventListener('click', swallow, { capture: true }),
            300,
          );

          const target = locate(e.clientX, e.clientY);
          if (target !== undefined && target !== from) {
            void move(rows.map((r) => r.playerId), target);
          }
        }
        setDrag(null);
      };

      window.addEventListener('pointermove', onMoveEvent);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
      dragTeardown.current = teardown;
    },
    [canEdit, busy, locate, selected, source, buckets],
  );

  const selectedRows = useMemo(
    () =>
      [...source, ...buckets.flatMap((b) => b.members)].filter((p) => selected.has(p.playerId)),
    [source, buckets, selected],
  );

  if (gate) {
    return <EmptyState glyph="◫" title={gate.title} description={gate.body} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-fg/62">
        <Spinner size={18} />
        <span className="text-[13.5px]">Loading participants…</span>
      </div>
    );
  }

  const card = (row: PlayerMaster, from: ZoneId) => {
    const isSelected = selected.has(row.playerId);
    return (
      <motion.li
        key={row.playerId}
        layout={!reduceMotion}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: DURATION.fast, ease: EASE.smooth }}
        onPointerDown={(event) => beginDrag(event, row, from)}
        style={{ touchAction: canEdit ? 'none' : undefined }}
        className={clsx(
          'select-none rounded-lg border px-2.5 py-2 transition-colors',
          isSelected
            ? 'border-solar-500/60 bg-solar-500/[0.14]'
            : 'border-fg/12 bg-fg/[0.04] hover:border-fg/24 hover:bg-fg/[0.07]',
          canEdit && 'cursor-grab active:cursor-grabbing',
        )}
        role="button"
        tabIndex={canEdit ? 0 : -1}
        aria-pressed={isSelected}
        onClick={() => {
          if (canEdit) toggle(row.playerId);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (canEdit) toggle(row.playerId);
          }
        }}
      >
        <span className="block truncate text-[13px] font-medium text-fg">{row.name}</span>
        <span className="block truncate text-[11.5px] text-fg/58">
          {row.department || row.email}
        </span>
      </motion.li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Full width on a phone — sharing the row with the hint squeezed
            this down to an unusable sliver. */}
        <div className="w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search the unassigned list…"
            aria-label="Search participants"
          />
        </div>
        {selected.size > 0 && (
          <>
            <Badge tone="warning" glyph="◆">
              {selected.size} selected
            </Badge>
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          </>
        )}
        <span className="w-full text-[12px] text-fg/58 sm:ml-auto sm:w-auto sm:text-right">
          Drag a card, or select and use a bucket&rsquo;s button.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
        {/* Unassigned */}
        <section
          ref={registerZone(null)}
          className={clsx(
            'rounded-2xl border p-3 transition-colors',
            drag?.over === null && drag.from !== null
              ? 'border-solar-400 bg-solar-500/[0.10]'
              : 'border-fg/14 bg-fg/[0.02]',
          )}
        >
          <header className="mb-2.5 flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg/72">
              {sourceLabel}
            </h3>
            <span className="font-mono text-[11.5px] text-fg/58">{source.length}</span>
          </header>

          {/* Always a list, even when empty — an empty column still has to
              read as somewhere you can drop, or there is no way to discover
              that a card can be dragged back out of a bucket. */}
          <ul className="max-h-[520px] min-h-[72px] space-y-1.5 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>{source.map((row) => card(row, null))}</AnimatePresence>
            {source.length === 0 && (
              <li className="grid min-h-[72px] place-items-center rounded-lg border border-dashed border-fg/16 px-2 py-4 text-center text-[11.5px] leading-relaxed text-fg/45">
                {sourceHint}
              </li>
            )}
          </ul>

          {selectedRows.some((r) => !source.includes(r)) && canEdit && (
            <Button
              variant="subtle"
              size="sm"
              className="mt-2 w-full"
              disabled={busy}
              onClick={() => void move(selectedRows.map((r) => r.playerId), null)}
            >
              Move {selectedRows.length} back here
            </Button>
          )}
        </section>

        {/* Buckets */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {buckets.map((bucket) => {
            const isOver = drag?.over === bucket.id && drag.from !== bucket.id;
            return (
              <section
                key={bucket.id}
                ref={registerZone(bucket.id)}
                className={clsx(
                  'flex flex-col rounded-2xl border p-3 transition-colors',
                  isOver
                    ? 'border-solar-400 bg-solar-500/[0.10]'
                    : 'border-fg/14 bg-surface-raised/40',
                )}
              >
                <header className="mb-2.5 px-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-[12px] font-bold uppercase tracking-[0.12em] text-fg/72">
                      {bucket.label}
                    </h3>
                    <span className="font-mono text-[11.5px] text-fg/58">
                      {bucket.members.length}
                    </span>
                  </div>
                  {bucket.hint && (
                    <p className="mt-0.5 truncate text-[11px] text-fg/48">{bucket.hint}</p>
                  )}
                </header>

                <ul className="min-h-[72px] flex-1 space-y-1.5 overflow-y-auto pr-0.5 xl:max-h-[300px]">
                  <AnimatePresence initial={false}>
                    {bucket.members.map((row) => card(row, bucket.id))}
                  </AnimatePresence>
                  {bucket.members.length === 0 && (
                    <li className="grid h-[72px] place-items-center rounded-lg border border-dashed border-fg/16 text-[11.5px] text-fg/45">
                      Drop here
                    </li>
                  )}
                </ul>

                {selected.size > 0 && canEdit && (
                  <Button
                    variant="solar"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={busy}
                    onClick={() => void move([...selected], bucket.id)}
                  >
                    Move {selected.size} here
                  </Button>
                )}
              </section>
            );
          })}

          {buckets.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                glyph="◐"
                title="Nothing to classify into"
                description="No types are configured for this selection yet. Add them in Master setup first."
              />
            </div>
          )}
        </div>
      </div>

      {/* The card that follows the cursor. Portalled so neither panel's
          overflow can clip it, and inert so it never blocks the hit test. */}
      {drag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[70] rounded-lg border border-solar-400 bg-surface-raised px-2.5 py-2 shadow-2xl"
            style={{
              left: Math.min(Math.max(drag.x - drag.offsetX, 8), window.innerWidth - drag.width - 8),
              top: drag.y - drag.offsetY,
              width: drag.width,
              transform: 'rotate(1.5deg)',
            }}
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
    </div>
  );
}
