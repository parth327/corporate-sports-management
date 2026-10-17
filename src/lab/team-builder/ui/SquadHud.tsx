import { forwardRef, useEffect, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import clsx from 'clsx';
import { FORMATION_IDS, SLOT_COUNT, type FormationId } from '../data/squad';
import { summarize, useBuilder } from '../store/builderStore';
import { groundEverything } from '../interaction/dragController';
import { bridge } from '../store/spatialBridge';
import { Segmented, type SegmentOption } from './Segmented';

/* Named by their visible text alone ("4-3-3"), so voice control can say what it sees; the group supplies "Formation". */
const FORMATION_OPTIONS: SegmentOption<FormationId>[] = FORMATION_IDS.map((id) => ({ id, label: id }));

/** A number that counts to its new value on a spring instead of jumping. */
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const reduced = useReducedMotion();
  const spring = useSpring(value, { stiffness: 150, damping: 24 });
  useEffect(() => {
    if (reduced) spring.jump(value);
    else spring.set(value);
  }, [spring, value, reduced]);
  const text = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);
  return <motion.span>{text}</motion.span>;
}

function Stat({ label, children, accent }: { label: string; children: ReactNode; accent: string }) {
  return (
    <div className="flex flex-col items-start">
      <dt className="tb-fs-micro font-mono uppercase tracking-hud text-white/60">{label}</dt>
      <dd className="tb-fs-stat mt-1 font-display tabular-nums" style={{ color: accent }}>
        {children}
      </dd>
    </div>
  );
}

/** A team number, or a dash until there is a team to measure: a rating of 0 would read as a verdict. */
function TeamNumber({ value, filled, suffix }: { value: number; filled: number; suffix?: string }) {
  if (filled === 0) {
    return (
      <>
        <span aria-hidden="true">–</span>
        <span className="sr-only">none yet</span>
      </>
    );
  }
  return <Counter value={value} suffix={suffix} />;
}

/** How much of the eleven is picked, as a ring that fills on a spring. */
function FillRing({ filled, label }: { filled: number; label: string }) {
  const reduced = useReducedMotion();
  const progress = useSpring(filled / SLOT_COUNT, { stiffness: 120, damping: 20 });
  useEffect(() => {
    if (reduced) progress.jump(filled / SLOT_COUNT);
    else progress.set(filled / SLOT_COUNT);
  }, [progress, filled, reduced]);
  return (
    <div className="flex flex-col items-start">
      <dt className="tb-fs-micro font-mono uppercase tracking-hud text-white/60">{label}</dt>
      <dd className="tb-fs-title mt-1 flex items-center gap-[0.4em] font-display tabular-nums text-white">
        <svg viewBox="0 0 40 40" className="h-[1.35em] w-[1.35em] -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
          <motion.circle
            cx="20"
            cy="20"
            r="15"
            fill="none"
            stroke="#FFCB00"
            strokeWidth="6"
            strokeLinecap="round"
            style={{ pathLength: progress }}
          />
        </svg>
        <span>
          {filled}
          <span className="text-white/60">/{SLOT_COUNT}</span>
        </span>
      </dd>
    </div>
  );
}

function HudButton({
  children,
  label,
  onClick,
  disabled,
  tone = 'ghost',
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'ghost' | 'solar';
}) {
  /*
   * aria-disabled rather than disabled: Clear disables itself the moment it is
   * pressed, and a focused button that becomes `disabled` drops keyboard focus
   * to <body>. This one stays focusable and simply does nothing.
   */
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onClick();
      }}
      aria-disabled={disabled || undefined}
      aria-label={label}
      title={label}
      className={clsx(
        'tb-fs-small inline-flex min-h-[2.5rem] min-w-[2.5rem] items-center justify-center gap-2 rounded-full px-[1em] font-mono font-semibold uppercase tracking-wider2 outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-solar-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b18]',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
        tone === 'solar'
          ? 'bg-solar-500 text-ink-900 hover:bg-solar-400'
          : 'text-white/85 ring-1 ring-white/15 hover:bg-white/10 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

/* Both rewrite the whole lineup, so any drag or flight in progress comes down first. */
const autoPickNow = () => {
  groundEverything();
  useBuilder.getState().autoPick();
};
const clearNow = () => {
  groundEverything();
  useBuilder.getState().clear();
};

const icon = {
  spark: 'M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z',
  clear: 'M3 3l10 10M13 3 3 13',
  recentre: 'M8 2.5a5.5 5.5 0 1 1-5.2 3.7M2.5 2.5v3.5H6',
};

function Glyph({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Title, formation, the team's numbers and the actions, on one pane of glass
 * along the top. Compact on phones: the stats shrink to a line and the
 * actions to icons, so the pitch keeps the height.
 */
export const SquadHud = forwardRef<HTMLElement, { compact: boolean }>(function SquadHud({ compact }, ref) {
  const formation = useBuilder((s) => s.formation);
  const lineup = useBuilder((s) => s.lineup);
  const setFormation = useBuilder((s) => s.setFormation);
  const summary = useMemo(() => summarize(lineup, formation), [lineup, formation]);

  return (
    <header
      ref={ref}
      className={clsx(
        'tb-glass pointer-events-auto flex flex-wrap items-center gap-x-[calc(var(--tb-gap)*1.6)] gap-y-3 tb-fs-body',
        compact ? 'rounded-[1.2rem] px-3 py-2.5' : 'rounded-[1.6rem] px-[1.2em] py-[0.85em]',
      )}
    >
      {/*
        Two deliberate rows until there is room for one: title and numbers on
        top, formation and actions below. At 1920px and up the break collapses
        and the order changes to title, formation, numbers, actions.
      */}
      <div className="order-1 flex min-w-0 items-center gap-3">
        <Link
          to="/"
          aria-label="Back to the Corporate Sports Events Management site"
          className={clsx(
            'grid shrink-0 place-items-center rounded-full text-white/80 ring-1 ring-white/15 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-solar-400',
            compact ? 'h-9 w-9' : 'h-10 w-10',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0">
          {!compact && <p className="tb-fs-micro font-mono uppercase tracking-hud text-white/60">Corporate Premier League · Lab</p>}
          <h1 className="tb-fs-title truncate font-display text-white">Team Builder</h1>
        </div>
      </div>

      <dl className="order-2 ml-auto flex items-center gap-[calc(var(--tb-gap)*1.4)] 3xl:order-3">
        <Stat label="Rating" accent="#FFD633">
          <TeamNumber value={summary.rating} filled={summary.filled} />
        </Stat>
        {!compact && (
          <Stat label="Fit" accent="#5FD4AC">
            <TeamNumber value={summary.fitPct} filled={summary.filled} suffix="%" />
          </Stat>
        )}
        <FillRing filled={summary.filled} label={compact ? 'XI' : 'Starting XI'} />
      </dl>

      <div aria-hidden="true" className="order-3 h-0 basis-full 3xl:hidden" />

      <Segmented
        id="tb-formation"
        label="Formation"
        options={FORMATION_OPTIONS}
        value={formation}
        onChange={setFormation}
        className={clsx('order-4 3xl:order-2', compact && 'w-full justify-between sm:w-auto')}
      />

      <div className={clsx('order-5 ml-auto flex items-center gap-2 3xl:ml-0', compact && 'hidden sm:flex')}>
        <HudButton label="Auto-pick the best eleven" onClick={autoPickNow} tone="solar">
          <Glyph d={icon.spark} />
          {!compact && <span>Auto-pick</span>}
        </HudButton>
        <HudButton label="Clear the pitch" onClick={clearNow} disabled={summary.filled === 0}>
          <Glyph d={icon.clear} />
          {!compact && <span>Clear</span>}
        </HudButton>
        <HudButton label="Recentre the camera" onClick={() => bridge.recentre?.()}>
          <Glyph d={icon.recentre} />
        </HudButton>
      </div>
    </header>
  );
});

/** On phones the actions leave the header and stand at the pitch's edge, like a map's controls, so the header stays two rows. */
export const CompactActions = forwardRef<HTMLDivElement>(function CompactActions(_, ref) {
  const filled = useBuilder((s) => s.lineup.filter(Boolean).length);
  return (
    <div ref={ref} className="tb-glass pointer-events-auto flex flex-col gap-1.5 rounded-full p-1.5 sm:hidden">
      <HudButton label="Auto-pick the best eleven" onClick={autoPickNow} tone="solar">
        <Glyph d={icon.spark} />
      </HudButton>
      <HudButton label="Clear the pitch" onClick={clearNow} disabled={filled === 0}>
        <Glyph d={icon.clear} />
      </HudButton>
      <HudButton label="Recentre the camera" onClick={() => bridge.recentre?.()}>
        <Glyph d={icon.recentre} />
      </HudButton>
    </div>
  );
});
