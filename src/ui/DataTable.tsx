import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { DURATION, EASE } from '@/lib/motion.js';
import { Button, EmptyState, ErrorPanel, Spinner } from './primitives';

/**
 * One table component for all nineteen list screens.
 *
 * Below `md` it stops being a table and becomes a stack of cards: a nine-column
 * grid at phone width either clips or shrinks the text below a usable size, and
 * the blueprint's own PDF had to solve the same problem the same way.
 */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Hidden on the mobile card layout — use for low-value columns. */
  secondary?: boolean;
  /** Used as the card title on mobile. Exactly one column should set this. */
  primary?: boolean;
  /**
   * Set when `render` already returns its own link or button.
   *
   * The mobile card otherwise wraps the primary column in a <button> to carry
   * `onRowClick`, and an <a> or <button> inside that is invalid HTML which
   * React warns about and screen readers mis-announce.
   */
  selfLinking?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: { message: string } | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Rendered in the rightmost cell / card footer. */
  actions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  actions,
  onRowClick,
}: DataTableProps<T>) {
  if (error) {
    return (
      <div className="p-5">
        <ErrorPanel message={error.message} onRetry={onRetry} />
      </div>
    );
  }

  if (loading && !rows.length) {
    return (
      <div className="flex items-center justify-center gap-3 px-6 py-16 text-fg/62">
        <Spinner size={18} />
        <span className="text-[13.5px]">Loading records…</span>
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const primary = columns.find((c) => c.primary) ?? columns[0]!;
  const rest = columns.filter((c) => c !== primary);

  return (
    <div className={clsx('relative', loading && 'opacity-60 transition-opacity')}>
      {/* Wide screens (xl and up): a real table. Below that - phones and tablets, and laptops once the console sidebar has taken its share - rows become cards, so no action button is ever hidden behind a sideways scroll. */}
      <div className="scroll-hint-x hidden overflow-x-auto xl:block">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={clsx(
                    'whitespace-nowrap border-b border-fg/18 bg-fg/[0.05] px-4 py-3 text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/72',
                    column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  {column.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="border-b border-fg/18 bg-fg/[0.05] px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <motion.tr
                key={rowKey(row)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DURATION.fast, delay: Math.min(index * 0.015, 0.2) }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  'border-b border-fg/12 transition-colors last:border-b-0 hover:bg-fg/[0.055]',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(
                      'px-4 py-3 align-middle text-fg/86',
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">{actions(row)}</div>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per row.

          The card is a <div>, not a <button>. Columns are free to render their
          own buttons (a "Manage teams" action, say), and a button inside a
          button is invalid HTML that React warns about and screen readers
          mis-announce. Only the title line becomes a control, and only when
          there is a row action to trigger. */}
      <ul className="divide-y divide-fg/14 xl:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="p-4">
            <div className="mb-2.5 text-[15.5px] font-semibold text-fg">
              {onRowClick && !primary.selfLinking ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="w-full text-left underline-offset-4 hover:underline coarse:-my-2.5 coarse:py-2.5"
                >
                  {primary.render(row)}
                </button>
              ) : (
                primary.render(row)
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-4">
              {rest
                .filter((c) => !c.secondary)
                .map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-fg/58">
                      {column.header}
                    </dt>
                    <dd className="mt-0.5 truncate text-[13.5px] text-fg/86">{column.render(row)}</dd>
                  </div>
                ))}
            </dl>

            {actions && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-fg/14 pt-3">{actions(row)}</div>
            )}
          </li>
        ))}
      </ul>

      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
          <span className="rounded-full bg-surface-raised/90 px-3 py-1 text-[12px] text-fg/72 backdrop-blur">
            Updating…
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pagination
 * ------------------------------------------------------------------ */

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-fg/14 px-5 py-3"
    >
      <p className="text-[12.5px] text-fg/68" aria-live="polite">
        Showing <span className="text-fg/88">{from}</span>–<span className="text-fg/88">{to}</span> of{' '}
        <span className="text-fg/88">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="subtle"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          ← Prev
        </Button>
        <span className="px-1 font-mono text-[12.5px] text-fg/75">
          {page} / {pages}
        </span>
        <Button
          variant="subtle"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next →
        </Button>
      </div>
    </nav>
  );
}

/** The filter strip that sits above every list. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.luxe }}
      className="mb-4 flex flex-wrap items-end gap-3"
    >
      {children}
    </motion.div>
  );
}
