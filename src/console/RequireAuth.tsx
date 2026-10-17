import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/ui/primitives';
import { findNavItem } from './nav';

/**
 * Two gates, in order: are you signed in, and may you see this screen?
 *
 * The capability is read from the nav declaration for the current path, so a
 * route and its sidebar entry can never disagree about who is allowed in.
 *
 * This is a usability control, not a security boundary. The same matrix must be
 * enforced server-side — the blueprint is explicit that a hidden menu item is
 * not a permission.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initialising, can } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface">
        <div className="flex items-center gap-3 text-fg/68">
          <Spinner size={18} />
          <span className="text-[13.5px]">Restoring your session…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    /* Remember where they were headed so login can send them back. */
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  const item = findNavItem(location.pathname);

  if (item) {
    const roleAllowed = !item.roles || item.roles.includes(user.role);
    const capabilityAllowed = can(item.capability, item.action ?? 'view');
    if (!roleAllowed || !capabilityAllowed) return <Forbidden />;
  }

  return <>{children}</>;
}

export function Forbidden() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="mb-3 text-4xl text-fg/20" aria-hidden="true">
        ⚿
      </p>
      <h1 className="font-display text-2xl tracking-tight text-fg">Not available to your role</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-fg/72">
        Your account does not have permission for this screen. This is shown rather than hidden on
        purpose — a silent failure is worse than a clear refusal. Speak to the Main Administrator if
        you believe you should have access.
      </p>
    </div>
  );
}
