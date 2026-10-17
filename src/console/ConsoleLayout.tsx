import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { DURATION, EASE } from '@/lib/motion.js';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { config } from '@/api';
import { Badge, Button, Spinner } from '@/ui/primitives';
import { BrandLogo } from '@/ui/BrandLogo';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { ROLE_LABELS } from '@/rbac/matrix';
import { visibleSections } from './nav';

/**
 * The console shell.
 *
 * Desktop keeps a persistent rail; below `lg` it collapses to a drawer. The
 * WebGL arena from the public site is deliberately NOT mounted here — an admin
 * grid needs a calm, opaque surface, and the backdrop would cost a frame budget
 * that data tables should be spending on scrolling.
 */
export default function ConsoleLayout() {
  const { user, signOut, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Close the drawer on navigation — otherwise it covers the page you chose. */
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  /* A modal drawer: lock the page behind it, move focus in, keep Tab inside, close on Escape, hand focus back on close. */
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('a[href]')?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      const drawer = drawerRef.current;
      if (event.key !== 'Tab' || !drawer) return;
      const stops = [...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) return;
      const outside = !drawer.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const trigger = drawerTriggerRef.current;

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, [drawerOpen]);

  if (!user) return null;

  const sections = visibleSections(user.role, can);

  const handleSignOut = async () => {
    await signOut();
    toast.info('Signed out', 'Your session has been closed.');
    navigate('/login', { replace: true });
  };

  const rail = (
    <div className="flex h-full flex-col">
      <div className="border-b border-fg/14 px-4 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandLogo alt="Apex Corporate Enterprises" className="h-7 w-auto" />
        </Link>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-hud text-fg/58">
          Sports Events Console
        </p>
      </div>

      <nav aria-label="Console" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg/64">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/console'}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
                        isActive
                          ? 'bg-solar-500/12 font-semibold text-accent-solar'
                          : 'text-fg/78 hover:bg-fg/7 hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="nav-active"
                            transition={{ duration: DURATION.fast, ease: EASE.luxe }}
                            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-solar-400"
                          />
                        )}
                        <span aria-hidden="true" className="w-4 shrink-0 text-center text-[13.5px] opacity-70">
                          {item.glyph}
                        </span>
                        <span className="min-w-0 truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-fg/14 p-3">
        <Link
          to="/console/profile"
          className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-fg/7"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-spectrum text-[12px] font-extrabold text-ink-900">
            {user.displayName.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-fg">{user.displayName}</span>
            <span className="block truncate font-mono text-[11.5px] text-fg/62">
              {ROLE_LABELS[user.role]}
              {user.subGroupName ? ` · ${user.subGroupName}` : ' · All groups'}
            </span>
          </span>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="mt-2 w-full">
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface">
      {/* Persistent rail, large screens only. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-fg/14 bg-surface-raised/60 backdrop-blur-xl lg:block">
        {rail}
      </aside>

      {/* Drawer, small screens. */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-surface/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              ref={drawerRef}
              id="console-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Console navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: DURATION.base, ease: EASE.luxe }}
              className="fixed inset-y-0 left-0 z-50 w-[17rem] border-r border-fg/16 bg-surface-raised lg:hidden"
            >
              {rail}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-fg/14 bg-surface/85 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button
            ref={drawerTriggerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="console-drawer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-fg/22 text-fg/86 transition-colors hover:text-fg lg:hidden"
          >
            <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
              <path d="M0 1h16M0 6h16M0 11h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11.5px] uppercase tracking-hud text-fg/58">
              <span className="hidden lg:inline">Corporate Sports Events Management</span>
              <span className="lg:hidden">Sports Events</span>
              {' · Season 2026'}
            </p>
          </div>

          {config.useMockApi && (
            <Badge tone="warning" glyph="◐" className="hidden sm:inline-flex">
              Demo data
            </Badge>
          )}

          <ThemeToggle />

          <Link
            to="/"
            className="shrink-0 rounded-full border border-fg/22 px-3 py-1.5 text-[12.5px] text-fg/82 transition-colors hover:border-fg/48 hover:text-fg coarse:-my-1 coarse:py-2.5"
          >
            View site ↗
          </Link>
        </header>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE.luxe }}
          className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8"
        >
          {/* A page's chunk loads inside the shell, instead of the whole console blanking to the app-level fallback. */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center gap-3 py-24 text-fg/68" role="status">
                <Spinner size={18} />
                <span className="text-[13.5px]">Loading…</span>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </motion.main>
      </div>
    </div>
  );
}
