import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { PlayerMaster } from '@/api';
import { Modal } from '@/ui/Modal';
import { Badge, Dash, MailLink, PhoneLink, StatusPill, WhatsAppLink } from '@/ui/primitives';
import { DURATION, EASE } from '@/lib/motion.js';
import { PlayerBadge } from './PlayerBadge';

/**
 * The participant card.
 *
 * Opened from anywhere a player's name appears. It exists so a moderator can
 * make an allocation decision without leaving the screen they are on, which is
 * why the badge and the facts share one dialog and the action sits in the
 * footer rather than three clicks away.
 */

export type Sport = 'cricket' | 'football' | 'creative';

/** The sub-group decides which figure is built. */
export function sportOf(player: Pick<PlayerMaster, 'subGroupName' | 'interest'>): Sport {
  const name = (player.subGroupName ?? '').toLowerCase();
  if (name.includes('cricket')) return 'cricket';
  if (name.includes('football')) return 'football';
  return 'creative';
}

export const STATUS_TONE: Record<PlayerMaster['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  Active: 'success',
  Pending: 'warning',
  Hold: 'warning',
  Rejected: 'danger',
};

function yearsOld(dateOfBirth?: string | null): string | null {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age -= 1;
  return age > 0 && age < 120 ? `${age} yrs` : null;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/58">{label}</dt>
      <dd className="mt-1 break-words text-[14px] leading-snug text-fg/90">{children}</dd>
    </div>
  );
}

interface PlayerCardProps {
  player: PlayerMaster | null;
  open: boolean;
  onClose: () => void;
  /** Team colour, so the jersey matches the side being considered. */
  accentColor?: string | null;
  /** Dialog footer — typically an allocate or release control. */
  actions?: ReactNode;
  /** A line above the details, e.g. which team they already hold. */
  note?: ReactNode;
}

export function PlayerCard({ player, open, onClose, accentColor, actions, note }: PlayerCardProps) {
  if (!player) return null;

  const sport = sportOf(player);
  const colour = accentColor ?? '#C72D86';
  const age = yearsOld(player.dateOfBirth);
  const classification = [
    player.interest,
    player.subGroupName,
    player.playerSubTypeName,
    player.playerSubTypeDetailName,
  ].filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={player.name}
      description={classification.join(' › ') || 'No classification recorded'}
      footer={actions}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ---------- The badge ---------- */}
        <div className="min-w-0">
          <PlayerBadge name={player.name} sport={sport} color={colour} statusTone={STATUS_TONE[player.status]} />
          <p className="mt-2 text-center text-[12px] text-fg/62">
            Move your pointer across the card to tilt it
          </p>
        </div>

        {/* ---------- The facts ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE.luxe }}
          className="min-w-0 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={player.status} />
            {player.subGroupName && <Badge tone="info">{player.subGroupName}</Badge>}
            {player.playerSubTypeName && <Badge tone="neutral">{player.playerSubTypeName}</Badge>}
            {!player.isActive && <Badge tone="danger" glyph="✕">Record inactive</Badge>}
          </div>

          {note && (
            <div className="rounded-xl border border-azure-500/45 bg-azure-500/[0.1] px-4 py-3 text-[13.5px] leading-relaxed text-azure-100">
              {note}
            </div>
          )}

          <dl className="grid gap-4 rounded-xl border border-fg/16 bg-fg/[0.04] p-4 sm:grid-cols-2">
            <Detail label="Email">
              <MailLink email={player.email} />
            </Detail>
            <Detail label="Mobile">
              <PhoneLink phone={player.mobileNo} />
            </Detail>
            <Detail label="WhatsApp">
              <WhatsAppLink phone={player.whatsAppNo} />
            </Detail>
            <Detail label="Employee code">{player.employeeCode || <Dash />}</Detail>
            <Detail label="Department">{player.department || <Dash />}</Detail>
            <Detail label="Date of birth">
              {player.dateOfBirth ? (
                <>
                  {player.dateOfBirth}
                  {age && <span className="ml-1.5 text-fg/62">· {age}</span>}
                </>
              ) : (
                <Dash />
              )}
            </Detail>
            <Detail label="Gender">{player.gender || <Dash />}</Detail>
            <Detail label="T-shirt">{player.tShirtSize || <Dash />}</Detail>
            <Detail label="Registered">{player.registeredOn || <Dash />}</Detail>
            <Detail label="Participant ID">
              <span className="font-mono">#{player.playerId}</span>
            </Detail>
          </dl>

          <div className="rounded-xl border border-fg/16 bg-fg/[0.04] p-4">
            <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/58">
              Emergency contact
            </p>
            {player.emergencyContactName || player.emergencyContactNo ? (
              <p className="text-[14px] text-fg/90">
                {player.emergencyContactName || 'Unnamed'}
                {player.emergencyContactNo && (
                  <>
                    {' · '}
                    <PhoneLink phone={player.emergencyContactNo} />
                  </>
                )}
              </p>
            ) : (
              <p className="text-[13.5px] text-fg/62">None on file.</p>
            )}
          </div>

          {player.medicalNotes && (
            <div className="rounded-xl border border-solar-600/50 bg-solar-600/[0.1] p-4">
              <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent-solar">
                Medical notes
              </p>
              <p className="text-[13.5px] leading-relaxed text-fg/88">{player.medicalNotes}</p>
            </div>
          )}
        </motion.div>
      </div>
    </Modal>
  );
}
