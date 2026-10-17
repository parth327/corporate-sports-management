import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * The console's form vocabulary.
 *
 * Everything accepts a ref so `react-hook-form`'s `register()` can be spread
 * straight onto it, and everything renders its own error text — WCAG 2.2
 * requires errors to be identified in text, never by colour alone, which is why
 * each control pairs the red ring with a written message and `aria-invalid`.
 */

/* ------------------------------------------------------------------ *
 * Field wrapper
 * ------------------------------------------------------------------ */

interface FieldProps {
  /** Omit for a control that labels itself, such as a lone checkbox. */
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={clsx('min-w-0', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg/78"
        >
          <span>
            {label}
            {required && (
              <span className="ml-1 text-accent-magenta" aria-hidden="true">
                *
              </span>
            )}
            {required && <span className="sr-only"> (required)</span>}
          </span>
          {hint && <span className="text-[11.5px] font-normal normal-case tracking-normal text-fg/58">{hint}</span>}
        </label>
      )}

      {children}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.fast }}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-accent-magenta"
        >
          <span aria-hidden="true" className="mt-px">
            ⚠
          </span>
          <span>{error}</span>
        </motion.p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Text-like inputs
 * ------------------------------------------------------------------ */

const controlBase =
  'w-full rounded-lg border bg-surface/60 px-3.5 py-2.5 text-[14.5px] text-fg placeholder:text-fg/45 ' +
  'transition-colors duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-45';

const controlTone = (invalid?: boolean) =>
  invalid
    ? 'border-magenta-500/70 focus:border-magenta-400'
    : 'border-fg/18 hover:border-fg/32 focus:border-azure-400';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(controlBase, controlTone(invalid), className)}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={clsx(controlBase, controlTone(invalid), 'resize-y leading-relaxed', className)}
      {...props}
    />
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  placeholder?: string;
  children: ReactNode;
}

/* ------------------------------------------------------------------ *
 * Select
 *
 * A native <select> everywhere a mouse and keyboard are in charge, so forms,
 * validation and screen readers behave exactly as before. On touch screens and
 * narrow windows the browser's own picker is unreliable (it can fail to open
 * when the control sits inside transformed or blurred parents, and it is a
 * tiny wheel or popup either way), so the tap opens a bottom sheet instead:
 * big rows, the current value ticked, a search box once the list is long.
 * The <select> stays in the page as the source of truth; choosing a row sets
 * its value and fires a real `change` event, so every onChange handler and
 * react-hook-form register() keeps working with no call-site changes.
 * ------------------------------------------------------------------ */

const SHEET_QUERY = '(pointer: coarse), (max-width: 639px)';
const subscribeSheet = (notify: () => void) => {
  const mql = window.matchMedia(SHEET_QUERY);
  mql.addEventListener('change', notify);
  return () => mql.removeEventListener('change', notify);
};
const useSheetMode = () =>
  useSyncExternalStore(
    subscribeSheet,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false,
  );

interface SheetOption {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}

function readOptions(select: HTMLSelectElement): SheetOption[] {
  return Array.from(select.options).map((o) => ({
    value: o.value,
    label: o.text,
    disabled: o.disabled,
    group: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : undefined,
  }));
}

function SelectSheet({
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  options: SheetOption[];
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const searchable = options.length > 8;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  /* Lock the page behind the sheet, and scroll the current choice into view. Escape is caught on the
     window in the capture phase: keyboard focus is still on the select underneath, not in the sheet,
     and a modal that opened this sheet must not see the key and close itself too. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.fast }}
        onClick={onClose}
        className="absolute inset-0 bg-surface/80 backdrop-blur-md"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: DURATION.base, ease: EASE.luxe }}
        className="glass-strong relative flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-fg/16 px-5 py-3.5">
          <h2 id={titleId} className="min-w-0 truncate text-[12px] font-bold uppercase tracking-[0.12em] text-fg/78">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg/72 transition-colors hover:bg-fg/10 hover:text-fg"
          >
            ✕
          </button>
        </header>

        {searchable && (
          <div className="border-b border-fg/12 px-4 py-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search…"
              aria-label={`Search ${title}`}
              className={clsx(controlBase, controlTone(false))}
            />
          </div>
        )}

        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={titleId}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {shown.length === 0 && <li className="px-5 py-6 text-center text-[13.5px] text-fg/62">Nothing matches.</li>}
          {shown.map((option, index) => {
            const selected = option.value === value;
            const newGroup = option.group && option.group !== shown[index - 1]?.group;
            return (
              <li key={`${option.value}-${index}`} role="presentation">
                {newGroup && (
                  <p className="px-5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fg/58">{option.group}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  onClick={() => onPick(option.value)}
                  className={clsx(
                    'flex min-h-[3rem] w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-[15px] transition-colors disabled:opacity-40',
                    selected ? 'bg-azure-500/15 font-semibold text-fg' : 'text-fg/88 hover:bg-fg/8 active:bg-fg/12',
                  )}
                >
                  <span className="min-w-0">{option.label || ' '}</span>
                  {selected && (
                    <span aria-hidden="true" className="shrink-0 text-accent-azure">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>,
    document.body,
  );
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, placeholder, children, className, ...props },
  ref,
) {
  const sheetMode = useSheetMode();
  const innerRef = useRef<HTMLSelectElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SheetOption[]>([]);

  const setRefs = useCallback(
    (node: HTMLSelectElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: HTMLSelectElement | null }).current = node;
    },
    [ref],
  );

  const openSheet = () => {
    const select = innerRef.current;
    if (!select) return;
    setOptions(readOptions(select));
    setOpen(true);
  };

  const closeSheet = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const pick = (value: string) => {
    const select = innerRef.current;
    if (select) {
      /* The prototype setter, not `select.value =`: it is what makes React see the change. */
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closeSheet();
  };

  const useSheet = sheetMode && !props.disabled;
  const labelText =
    (props.id && typeof document !== 'undefined'
      ? document.querySelector<HTMLLabelElement>(`label[for="${props.id}"]`)?.firstElementChild?.firstChild?.textContent?.trim()
      : undefined) ||
    props['aria-label'] ||
    placeholder ||
    'Choose an option';

  return (
    <div className="relative">
      <select
        ref={setRefs}
        aria-invalid={invalid || undefined}
        className={clsx(
          controlBase,
          controlTone(invalid),
          'cursor-pointer appearance-none pr-10 [&>option]:bg-surface-raised [&>option]:text-fg',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <svg
        aria-hidden="true"
        width="10"
        height="6"
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg/62"
      >
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {useSheet && (
        <>
          {/* Sits over the select and takes the tap. The select underneath still shows the value and
              is what assistive technology and forms talk to. */}
          <button
            ref={triggerRef}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={openSheet}
            className="absolute inset-0 z-[1] cursor-pointer rounded-lg"
          />
          <AnimatePresence>
            {open && (
              <SelectSheet
                title={labelText}
                options={options}
                value={innerRef.current?.value ?? ''}
                onPick={pick}
                onClose={closeSheet}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * Checkbox
 * ------------------------------------------------------------------ */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, ...props },
  ref,
) {
  return (
    <label
      className={clsx(
        'group flex cursor-pointer items-start gap-3 rounded-lg border border-fg/16 bg-fg/[0.04] p-3 transition-colors hover:border-fg/32',
        props.disabled && 'cursor-not-allowed opacity-45',
        className,
      )}
    >
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border border-fg/32 text-ink-900 transition-all peer-checked:border-solar-500 peer-checked:bg-solar-500 peer-focus-visible:ring-2 peer-focus-visible:ring-solar-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
      >
        <svg width="10" height="8" viewBox="0 0 10 8" className="opacity-0 transition-opacity peer-checked:opacity-100">
          <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] text-fg/92">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] text-fg/68">{description}</span>}
      </span>
    </label>
  );
});

/* ------------------------------------------------------------------ *
 * Chip group — the progressive-disclosure control from the blueprint
 * ------------------------------------------------------------------ */

export interface ChipOption {
  value: string | number;
  label: string;
  hint?: string;
}

interface ChipGroupProps {
  options: ChipOption[];
  value: string | number | null | undefined;
  onChange: (value: string | number) => void;
  name: string;
  invalid?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
}

export function ChipGroup({
  options,
  value,
  onChange,
  name,
  invalid,
  disabled,
  emptyLabel = 'Nothing to choose here yet.',
}: ChipGroupProps) {
  if (!options.length) {
    return <p className="py-2 text-[13.5px] text-fg/58">{emptyLabel}</p>;
  }

  return (
    <div
      role="radiogroup"
      aria-invalid={invalid || undefined}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const selected = String(option.value) === String(value ?? '');
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            name={name}
            onClick={() => onChange(option.value)}
            className={clsx(
              'relative rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45',
              selected
                ? 'border-transparent text-ink-900'
                : invalid
                  ? 'border-magenta-500/60 text-fg/86 hover:text-fg'
                  : 'border-fg/22 text-fg/82 hover:border-fg/48 hover:text-fg',
            )}
          >
            {/* Deliberately not a shared-layout `layoutId` pill. These chip
                groups mount and unmount as the classification branch changes,
                and a pending shared-layout animation on an unmounted element
                can stall the enclosing AnimatePresence — which stops the next
                wizard step from ever mounting. A local scale/fade is safe. */}
            {selected && (
              <motion.span
                initial={{ opacity: 0, scale: 0.86 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: DURATION.fast, ease: EASE.luxe }}
                className="absolute inset-0 rounded-full bg-solar-500"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select variant, used for officials on a fixture. */
interface ChipMultiProps {
  options: ChipOption[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
}

export function ChipMulti({ options, value, onChange, disabled, emptyLabel = 'None available.' }: ChipMultiProps) {
  if (!options.length) return <p className="py-2 text-[13.5px] text-fg/58">{emptyLabel}</p>;

  const toggle = (option: ChipOption) => {
    const exists = value.some((v) => String(v) === String(option.value));
    onChange(
      exists ? value.filter((v) => String(v) !== String(option.value)) : [...value, option.value],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.some((v) => String(v) === String(option.value));
        return (
          <button
            key={option.value}
            type="button"
            role="checkbox"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => toggle(option)}
            className={clsx(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45',
              selected
                ? 'border-azure-400 bg-azure-500/20 text-fg'
                : 'border-fg/22 text-fg/82 hover:border-fg/48 hover:text-fg',
            )}
          >
            <span
              aria-hidden="true"
              className={clsx(
                'grid h-3.5 w-3.5 place-items-center rounded-full border text-[8px]',
                selected ? 'border-azure-300 bg-azure-400 text-ink-900' : 'border-fg/38',
              )}
            >
              {selected ? '✓' : ''}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'solar' | 'ghost' | 'danger' | 'subtle';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-magenta-500 text-white hover:bg-magenta-400 disabled:hover:bg-magenta-500',
  solar: 'bg-solar-500 text-ink-900 hover:bg-solar-400 disabled:hover:bg-solar-500',
  ghost: 'border border-fg/26 text-fg/90 hover:border-fg/58 hover:text-fg',
  danger: 'border border-magenta-500/50 text-accent-magenta hover:border-magenta-400 hover:bg-magenta-500/10',
  subtle: 'bg-fg/[0.085] text-fg/88 hover:bg-fg/[0.14] hover:text-fg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, size = 'md', icon, children, className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors duration-200 coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-4 py-2 text-[13.5px]' : 'px-5 py-2.5 text-[14.5px]',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
});

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={clsx('animate-spin', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Badges & status
 * ------------------------------------------------------------------ */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-fg/22 bg-fg/[0.07] text-fg/78',
  success: 'border-phthalo-500/45 bg-phthalo-500/12 text-accent-phthalo',
  warning: 'border-solar-600/50 bg-solar-600/12 text-accent-solar',
  danger: 'border-magenta-500/45 bg-magenta-500/12 text-accent-magenta',
  info: 'border-azure-500/45 bg-azure-500/12 text-accent-azure',
};

/** Status never travels on colour alone — the glyph and the word carry it too. */
export function Badge({
  tone = 'neutral',
  children,
  glyph,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  glyph?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.07em]',
        BADGE_TONES[tone],
        className,
      )}
    >
      {glyph && <span aria-hidden="true">{glyph}</span>}
      {children}
    </span>
  );
}

const STATUS_MAP: Record<string, { tone: BadgeTone; glyph: string }> = {
  Active: { tone: 'success', glyph: '●' },
  Completed: { tone: 'info', glyph: '✓' },
  Scheduled: { tone: 'success', glyph: '▸' },
  Pending: { tone: 'warning', glyph: '◐' },
  Hold: { tone: 'warning', glyph: '‖' },
  Rejected: { tone: 'danger', glyph: '✕' },
  Cancelled: { tone: 'danger', glyph: '✕' },
  Inactive: { tone: 'neutral', glyph: '○' },
};

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_MAP[status] ?? { tone: 'neutral' as BadgeTone, glyph: '○' };
  return (
    <Badge tone={meta.tone} glyph={meta.glyph}>
      {status}
    </Badge>
  );
}

export function ActiveFlag({ isActive }: { isActive: boolean }) {
  return <StatusPill status={isActive ? 'Active' : 'Inactive'} />;
}

/* ------------------------------------------------------------------ *
 * Links
 * ------------------------------------------------------------------ */

/**
 * A value that should be actionable rather than merely printed.
 *
 * `stopPropagation` is the point of these: every one of them sits inside a
 * table row or card that has its own click handler, and a mail link that also
 * opens the edit dialog behind it is worse than no link at all.
 */
function ValueLink({
  href,
  children,
  title,
  external,
}: {
  href: string;
  children: ReactNode;
  title?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      title={title}
      onClick={(event) => event.stopPropagation()}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="link break-words"
    >
      {children}
    </a>
  );
}

/** An email address, as a mailto. Renders a dash when there is nothing to link. */
export function MailLink({ email, label }: { email?: string | null; label?: ReactNode }) {
  if (!email) return <Dash />;
  return (
    <ValueLink href={`mailto:${email}`} title={`Email ${email}`}>
      {label ?? email}
    </ValueLink>
  );
}

/** A phone number, as a tel. Spaces are stripped from the href, kept in the text. */
export function PhoneLink({ phone, label }: { phone?: string | null; label?: ReactNode }) {
  if (!phone) return <Dash />;
  return (
    <ValueLink href={`tel:${phone.replace(/[^\d+]/g, '')}`} title={`Call ${phone}`}>
      <span className="whitespace-nowrap font-mono">{label ?? phone}</span>
    </ValueLink>
  );
}

/** A WhatsApp number, as a wa.me deep link. */
export function WhatsAppLink({ phone }: { phone?: string | null }) {
  if (!phone) return <Dash />;
  const digits = phone.replace(/\D/g, '');
  return (
    <ValueLink href={`https://wa.me/${digits}`} title={`WhatsApp ${phone}`} external>
      <span className="whitespace-nowrap font-mono">{phone}</span>
    </ValueLink>
  );
}

/** The placeholder for an absent value. One glyph, one meaning, everywhere. */
export function Dash() {
  return (
    <span className="text-fg/64" aria-label="Not provided">
      —
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={clsx('glass rounded-2xl', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-fg/14 px-5 py-3.5">
          {typeof title === 'string' ? (
            <h2 className="text-[12px] font-bold uppercase tracking-[0.13em] text-fg/72">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  glyph = '◇',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  glyph?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full border border-fg/16 bg-fg/[0.05] text-xl text-fg/45">
        {glyph}
      </span>
      <p className="text-[15.5px] font-semibold text-fg/90">{title}</p>
      {description && <p className="max-w-sm text-[13.5px] leading-relaxed text-fg/68">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Inline error panel, used above forms when the failure is not field-specific. */
export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-magenta-500/35 bg-magenta-500/[0.07] px-4 py-3"
    >
      <span aria-hidden="true" className="text-accent-magenta">
        ⚠
      </span>
      <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-magenta-100">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Page-level heading used by every console screen. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.luxe }}
      className="mb-6 flex flex-wrap items-end justify-between gap-4"
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[11.5px] uppercase tracking-hud text-accent-solar">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl leading-tight tracking-tightest text-fg sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-fg/72">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}
