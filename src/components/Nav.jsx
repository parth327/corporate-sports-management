import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { COMPANY } from '../lib/site-data.js';
import { DURATION, EASE } from '../lib/motion.js';
import { useScrollLock, useScrolled } from '../lib/hooks.js';
import { ThemeToggle } from '../ui/ThemeToggle';
import { BrandLogo } from '../ui/BrandLogo';

/** Every section, for the menu. The inline bar shows the `primary` ones until there is room for all. */
const LINKS = [
  { href: '#about-company', label: 'About ACE', primary: true },
  { href: '#heritage', label: 'Since 2001', primary: false },
  { href: '#events', label: 'Events', primary: true },
  { href: '#spotlight', label: 'Flagships', primary: false },
  { href: '#calendar', label: 'Calendar', primary: true },
  { href: '#standings', label: 'Colour League', primary: true },
  { href: '#gallery', label: 'Gallery', primary: true },
];

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * The corporate lockup, taken from example.com so the events portal is visibly
 * the same company.
 *
 * Colour here tracks `scrolled`, not the site theme: unscrolled, this header
 * is transparent and sits directly over the stadium, which stays night-dark in
 * both themes — so the wordmark stays literal white until the header reaches
 * its own opaque `bg-surface`, at which point the theme-reactive `fg` token
 * takes over.
 */
function Logo({ onDark }) {
  return (
    <span className="flex items-center gap-3 sm:gap-4">
      <BrandLogo alt={COMPANY.name} className="h-8 w-auto sm:h-9" forceWhite={onDark} />
      <span
        className={clsx('hidden h-8 w-px md:block', onDark ? 'bg-white/20' : 'bg-fg/20')}
        aria-hidden="true"
      />
      <span className="hidden max-w-[12.5rem] leading-none md:block">
        <span
          className={clsx(
            'block font-display text-[13px] uppercase leading-[1.15] tracking-[0.1em]',
            onDark ? 'text-white' : 'text-fg',
          )}
        >
          {COMPANY.portal}
        </span>
        <span
          className={clsx(
            'mt-1 block font-mono text-[10px] uppercase tracking-hud',
            onDark ? 'text-white/70' : 'text-fg/70',
          )}
        >
          {COMPANY.season}
        </span>
      </span>
    </span>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled(24);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  useScrollLock(open);

  const close = () => setOpen(false);

  /* The open menu is a modal: focus moves in, Tab stays inside, Escape closes, focus returns to the button. */
  useEffect(() => {
    if (!open) return undefined;
    const toggle = toggleRef.current;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector(FOCUSABLE)?.focus());

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !menuRef.current) return;
      /* In DOM order: the toggle sits in the header, before the menu, so it is the cycle's first stop, not its last. */
      const nodes = [toggle, ...menuRef.current.querySelectorAll(FOCUSABLE)].filter(Boolean);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      if (document.activeElement === document.body || menuRef.current?.contains(document.activeElement)) {
        toggle?.focus();
      }
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: DURATION.slow, ease: EASE.luxe, delay: 0.2 }}
        className={`fixed inset-x-0 top-0 z-40 transition-colors duration-500 ${
          solid ? 'border-b border-fg/10 bg-surface/80 backdrop-blur-xl' : 'border-b border-transparent'
        }`}
        style={{ height: 'var(--nav-h)' }}
      >
        <nav className="shell flex h-full items-center justify-between gap-6" aria-label="Primary">
          <a href="#top" className="shrink-0" onClick={close}>
            <Logo onDark={!solid} />
          </a>

          <ul className="hidden items-center gap-0.5 xl:flex">
            {LINKS.map((link) => (
              <li key={link.href} className={link.primary ? undefined : 'hidden 3xl:block'}>
                <a
                  href={link.href}
                  className={clsx(
                    'group relative block whitespace-nowrap px-3 py-2 font-cond text-[14.5px] uppercase tracking-wider2 transition-colors',
                    solid ? 'text-fg/80 hover:text-fg' : 'text-white/85 hover:text-white',
                  )}
                >
                  {link.label}
                  <span className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-solar-400 transition-transform duration-300 group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>

          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle className="hidden sm:inline-flex" />

            <a
              href="#register"
              className="hidden whitespace-nowrap rounded-full bg-solar-500 px-6 py-2.5 font-cond text-sm font-semibold uppercase tracking-wider2 text-ink-900 transition-colors hover:bg-solar-400 sm:inline-flex"
            >
              Take part
            </a>

            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className={clsx(
                'relative z-50 grid h-11 w-11 place-items-center rounded-full border xl:hidden',
                solid ? 'border-fg/20 text-fg' : 'border-white/25 text-white',
              )}
            >
              <span className="relative block h-3 w-5">
                <motion.span
                  animate={open ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE.smooth }}
                  className="absolute inset-x-0 top-0 block h-[1.5px] bg-current"
                />
                <motion.span
                  animate={open ? { opacity: 0 } : { opacity: 1 }}
                  transition={{ duration: DURATION.fast }}
                  className="absolute inset-x-0 top-[5px] block h-[1.5px] bg-current"
                />
                <motion.span
                  animate={open ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE.smooth }}
                  className="absolute inset-x-0 top-[10px] block h-[1.5px] bg-current"
                />
              </span>
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="fixed inset-0 z-30 overflow-y-auto bg-surface/95 pt-[var(--nav-h)] backdrop-blur-2xl xl:hidden"
          >
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { delayChildren: 0.12, staggerChildren: 0.06 } } }}
              className="shell flex min-h-full flex-col justify-center gap-1 py-8"
            >
              {LINKS.map((link) => (
                <motion.li
                  key={link.href}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.luxe } },
                  }}
                >
                  <a
                    href={link.href}
                    onClick={close}
                    className="block border-b border-fg/10 py-4 font-display text-[clamp(1.75rem,7vw,2.25rem)] uppercase tracking-tight text-fg/90 transition-colors hover:text-accent-solar"
                  >
                    {link.label}
                  </a>
                </motion.li>
              ))}

              <motion.li
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.luxe } },
                }}
                className="flex items-center justify-between gap-4 pt-8"
              >
                <a href="#register" onClick={close} className="btn-primary flex-1">
                  Take part
                </a>
                <ThemeToggle />
              </motion.li>
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
