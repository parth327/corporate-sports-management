import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DURATION, EASE } from '@/lib/motion.js';

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (tone: ToastTone, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { bar: string; icon: string; glyph: string }> = {
  success: { bar: 'bg-phthalo-500', icon: 'text-accent-phthalo', glyph: '✓' },
  error: { bar: 'bg-magenta-500', icon: 'text-accent-magenta', glyph: '!' },
  info: { bar: 'bg-azure-500', icon: 'text-accent-azure', glyph: 'i' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, title, description }]);
      /* Errors linger — the user may need to read a field name. */
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:p-0"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = TONE_STYLES[toast.tone];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                transition={{ duration: DURATION.fast, ease: EASE.luxe }}
                className="glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl p-3.5 shadow-2xl"
              >
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fg/7 text-[12px] font-bold ${tone.icon}`}>
                  {tone.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 break-words text-[13.5px] leading-snug text-fg/75">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="-m-1 shrink-0 rounded p-1 text-fg/58 transition-colors hover:text-fg"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
                <span className={`absolute inset-x-0 bottom-0 h-0.5 ${tone.bar}`} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
