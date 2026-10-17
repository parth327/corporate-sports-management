import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GALLERY, GALLERY_COPY } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import { useScrollLock } from '../lib/hooks.js';
import SectionHeading from './ui/SectionHeading.jsx';

/**
 * Photo archive with a shared-element lightbox.
 *
 * The thumbnail and the full-size image share a `layoutId`, so framer animates
 * the actual image between the two positions instead of fading one out and the
 * other in. It costs nothing extra and it is the difference between a modal
 * that appears and a photograph that grows.
 */
export default function Gallery() {
  const [openIndex, setOpenIndex] = useState(null);
  const open = openIndex !== null;
  const active = open ? GALLERY[openIndex] : null;
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  /* Taken from the click, not document.activeElement: Safari does not focus a button when it is clicked. */
  const openerRef = useRef(null);
  useScrollLock(open);

  const step = (delta) => setOpenIndex((i) => (i + delta + GALLERY.length) % GALLERY.length);

  /* A modal like any other: focus moves in, Tab stays inside, Escape closes, and focus goes back to the photo that opened it. */
  useEffect(() => {
    if (!open) return undefined;
    const opener = openerRef.current;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());

    const onKey = (e) => {
      if (e.key === 'Escape') setOpenIndex(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'Tab' && dialogRef.current) {
        const nodes = [...dialogRef.current.querySelectorAll('button')];
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <section id="gallery" className="relative py-24 sm:py-32">
      <div className="shell">
        <SectionHeading
          eyebrow={GALLERY_COPY.eyebrow}
          title={GALLERY_COPY.title}
          body={GALLERY_COPY.body}
          accentClass="text-azure-400"
        />

        <div className="mt-14 grid auto-rows-[190px] grid-cols-2 gap-3 sm:auto-rows-[220px] lg:grid-cols-4 lg:gap-4">
          {GALLERY.map((shot, i) => (
            <motion.button
              key={shot.src}
              type="button"
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setOpenIndex(i);
              }}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={VIEWPORT}
              transition={{ duration: DURATION.slow, ease: EASE.luxe, delay: (i % 4) * 0.07 }}
              className={`group relative overflow-hidden rounded-xl border border-fg/10 ${shot.span}`}
              aria-label={`Open photo: ${shot.caption}`}
            >
              <motion.img
                layoutId={`gallery-${shot.src}`}
                src={shot.src}
                alt={shot.caption}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/10 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />

              <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-ink-900/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-hud text-white/70 backdrop-blur-md">
                {shot.tag}
              </span>

              <span className="absolute inset-x-3 bottom-3 text-left">
                <span className="block translate-y-2 font-cond text-sm leading-tight text-white/90 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  {shot.caption}
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/*
        Lightbox. Portalled to <body>: rendered in place it would sit inside
        `main`'s stacking context (z-10), under the fixed header and chapter
        rail whatever its own z-index, and their links would take its clicks.
      */}
      {createPortal(
        <AnimatePresence>
          {open && active && (
            <motion.div
              ref={dialogRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast }}
              onClick={() => setOpenIndex(null)}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/92 p-4 backdrop-blur-xl sm:p-10"
              role="dialog"
              aria-modal="true"
              aria-label={active.caption}
              data-lenis-prevent
            >
              <motion.img
                layoutId={`gallery-${active.src}`}
                src={active.src}
                alt={active.caption}
                className="max-h-[80dvh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.2, duration: DURATION.base }}
                className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-6 text-center"
              >
                <span className="hud-label !text-solar-400">{active.tag}</span>
                <p className="font-cond text-lg text-white/90">{active.caption}</p>
                <p className="font-mono text-[11px] uppercase tracking-hud text-white/70">
                  {openIndex + 1} / {GALLERY.length}
                  <span className="hidden sm:inline"> · Arrow keys to browse · Esc to close</span>
                </p>
              </motion.div>

              {[
                { delta: -1, label: 'Previous photo', path: 'M10 3L5 8l5 5', side: 'left-3 sm:left-6' },
                { delta: 1, label: 'Next photo', path: 'M6 3l5 5-5 5', side: 'right-3 sm:right-6' },
              ].map(({ delta, label, path, side }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    step(delta);
                  }}
                  className={`absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-ink-900/60 text-white/85 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white ${side}`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}

              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpenIndex(null)}
                aria-label="Close"
                className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white/85 transition-colors hover:border-white/60 hover:text-white"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  );
}
