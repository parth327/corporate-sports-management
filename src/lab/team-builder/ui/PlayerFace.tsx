import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { DIVISIONS, ROLE_COLOR, initials, type Player } from '../data/squad';
import type { CardVariant } from '../store/spatialBridge';

export const roleStyle = (player: Player) => ({ '--tb-role': ROLE_COLOR[player.role] }) as CSSProperties;

const STATS: { key: keyof Player['stats']; label: string }[] = [
  { key: 'pace', label: 'PAC' },
  { key: 'attack', label: 'ATT' },
  { key: 'passing', label: 'PAS' },
  { key: 'defence', label: 'DEF' },
];

/**
 * A player's token on the pitch. The dragged ghost ends its flight as exactly
 * this element at exactly the node's projected point, and the slot layer then
 * shows its own copy in the same place: the handoff is invisible because the
 * two are the same markup.
 */
export function PlayerChip({ player, className }: { player: Player; className?: string }) {
  return (
    <span className={clsx('tb-chip relative grid shrink-0 place-items-center', className)} style={roleStyle(player)}>
      <span className="font-display text-[0.95rem] leading-none text-white">{initials(player.name)}</span>
      <span className="absolute -bottom-1 -right-1.5 rounded-full bg-[#070b18] px-1.5 py-[3px] font-display text-[10.5px] leading-none text-white ring-1 ring-[color:var(--tb-role)]">
        {player.rating}
      </span>
    </span>
  );
}

/** The inside of a roster card, shared with the ghost so a lifted card looks like the card it left. */
export function CardFace({
  player,
  variant,
  position,
}: {
  player: Player;
  variant: CardVariant;
  /** Code of the slot the player occupies, when on the pitch. */
  position?: string | null;
}) {
  const division = DIVISIONS[player.division];
  return (
    <span className="flex h-full w-full flex-col justify-center gap-[0.55em] px-[0.8em] py-[0.65em]" style={roleStyle(player)}>
      <span className="flex items-center gap-[0.7em]">
        <span className="relative grid h-[2.6em] w-[2.6em] shrink-0 place-items-center rounded-full bg-[#0b1224] ring-2 ring-[color:var(--tb-role)]">
          <span className="font-display text-[0.9em] leading-none text-white">{initials(player.name)}</span>
          {division && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0b1224]"
              style={{ background: division.hex }}
            />
          )}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate font-cond text-white">{player.name}</span>
          <span className="tb-fs-small mt-0.5 block truncate text-white/70">
            {player.position} · #{player.number}
            {variant === 'rail' && division ? ` · ${division.name}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-display text-[1.45em] leading-none text-white">{player.rating}</span>
          {position ? (
            <span className="tb-fs-micro mt-1 rounded-full bg-[color:var(--tb-role)] px-1.5 py-px font-mono font-bold uppercase text-[#060913]">
              {position}
            </span>
          ) : (
            <span className="tb-fs-micro mt-1 font-mono uppercase tracking-hud text-[color:var(--tb-role)]">{player.role}</span>
          )}
        </span>
      </span>
      {variant === 'rail' && (
        <span className="grid grid-cols-4 gap-[0.6em]" aria-hidden="true">
          {STATS.map(({ key, label }) => (
            <span key={key} className="min-w-0">
              <span className="tb-fs-micro flex justify-between font-mono text-white/60">
                <span>{label}</span>
                <span className="text-white/85">{player.stats[key]}</span>
              </span>
              <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-[color:var(--tb-role)]"
                  style={{ width: `${player.stats[key]}%`, opacity: 0.45 + player.stats[key] / 200 }}
                />
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
