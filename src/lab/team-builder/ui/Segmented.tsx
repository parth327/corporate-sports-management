import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  /** Accessible name, when the visible label is terse. */
  name?: string;
  /** Accent for the selected pill; defaults to white. */
  color?: string;
}

/**
 * A radio group drawn as a segmented control: arrow keys move the choice (and
 * focus) along it, only the checked option is in the tab order, and the lit
 * pill glides between options on a shared layout id.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  id,
  className,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Unique per control on the page: it scopes the gliding pill. */
  id: string;
  className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = step === undefined ? -1 : (index + step + options.length) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    const option = options[next];
    if (!option) return;
    event.preventDefault();
    onChange(option.id);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={clsx('flex items-center gap-0.5 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10', className)}>
      {options.map((option, index) => {
        const checked = option.id === value;
        return (
          <button
            key={option.id}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.name}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={clsx(
              'tb-fs-small relative min-h-[2.25rem] whitespace-nowrap rounded-full px-[0.9em] font-mono font-semibold uppercase tracking-wider2 outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-solar-400',
              checked ? 'text-[#060913]' : 'text-white/75 hover:text-white',
            )}
          >
            {checked && (
              <motion.span
                layoutId={`${id}-pill`}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                className="absolute inset-0 rounded-full"
                style={{ background: option.color ?? '#ffffff', boxShadow: `0 0 18px -4px ${option.color ?? '#ffffff'}` }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
