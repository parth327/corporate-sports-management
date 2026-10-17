import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  useForm,
  useWatch,
  type FieldValues,
  type RegisterOptions,
  type UseFormReturn,
} from 'react-hook-form';
import { ApiError, type ListQuery, type Resource } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDebounced, useList, useMutation, useOptions, usePaging } from '@/hooks/useResource';
import type { Capability } from '@/api/types';
import { DataTable, Pagination, Toolbar, type Column } from '@/ui/DataTable';
import { ConfirmDialog, Modal } from '@/ui/Modal';
import {
  ActiveFlag,
  Button,
  Checkbox,
  ErrorPanel,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/ui/primitives';

/**
 * A configuration-driven master-data screen.
 *
 * Twelve of the blueprint's twenty-four forms are structurally identical: a
 * filtered list, a create/edit dialog, and a deactivate confirm. Writing them
 * twelve times would mean twelve places for the soft-delete rule or the scope
 * filter to drift. They are declared here instead, as data.
 *
 * Bespoke screens (registration, allocation, fixtures, results, reports) are
 * hand-written, because their business rules are not shaped like a form.
 */

/* ------------------------------------------------------------------ *
 * Field declarations
 * ------------------------------------------------------------------ */

export interface CrudOption {
  value: string | number;
  label: string;
}

export interface CrudFieldSource {
  /** Where the dropdown's rows come from. */
  resource: Resource<Record<string, unknown>>;
  valueKey: string;
  labelKey: string;
  /** Build the query from the form's current values — enables dependent lists. */
  query?: (values: Record<string, unknown>) => ListQuery;
  /** When this field changes, clear the dependent one. */
  dependsOn?: string;
}

export interface CrudField {
  name: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'tel'
    | 'password'
    | 'number'
    | 'textarea'
    | 'date'
    | 'time'
    | 'select'
    | 'checkbox';
  required?: boolean;
  hint?: ReactNode;
  placeholder?: string;
  /** Column span inside the two-column dialog grid. */
  span?: 1 | 2;
  options?: CrudOption[];
  source?: CrudFieldSource;
  defaultValue?: unknown;
  /** Render only when creating, or only when editing. */
  only?: 'create' | 'edit';
  min?: number;
  max?: number;
  maxLength?: number;
  /** Force a value and lock the control (used to pin an Event Team's sub-group). */
  lockedValue?: string | number | null;
  lockedReason?: string;
}

/* ------------------------------------------------------------------ *
 * A single dynamic select
 * ------------------------------------------------------------------ */

function SourceSelect({
  field,
  form,
  disabled,
}: {
  field: CrudField;
  form: UseFormReturn<FieldValues>;
  disabled?: boolean;
}) {
  const source = field.source!;
  /* useWatch re-renders only this select; form.watch() would re-render the whole dialog on every keystroke. */
  const values = useWatch({ control: form.control }) as Record<string, unknown>;
  const query = useMemo(
    () => source.query?.(values) ?? {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(source.query?.(values) ?? {})],
  );

  /* A dependent list is meaningless until its parent is chosen. */
  const parentValue = source.dependsOn ? values[source.dependsOn] : undefined;
  const enabled = !source.dependsOn || (parentValue !== undefined && parentValue !== '' && parentValue !== null);

  const { options, loading } = useOptions(source.resource, query, { enabled });

  /* Clear a stale child when the parent changes. */
  const currentValue = values[field.name];
  useEffect(() => {
    if (!enabled && currentValue) form.setValue(field.name, '');
  }, [enabled, currentValue, field.name, form]);

  /**
   * Re-apply the form value once the options exist.
   *
   * `form.reset()` runs when the dialog opens, but these <option>s arrive over
   * the network a moment later. A <select> silently ignores a value it has no
   * option for, so without this an edit dialog would open with every foreign-key
   * dropdown blank — and saving would then wipe the relationship.
   */
  useEffect(() => {
    if (!options.length) return;
    const desired = form.getValues(field.name);
    if (desired === undefined || desired === null || desired === '') return;

    const exists = options.some((o) => String(o[source.valueKey]) === String(desired));
    if (exists) form.setValue(field.name, String(desired), { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, field.name]);

  const error = form.formState.errors[field.name]?.message as string | undefined;

  return (
    <Field
      label={field.label}
      htmlFor={field.name}
      required={field.required}
      hint={field.hint}
      error={error}
      className={field.span === 2 ? 'sm:col-span-2' : undefined}
    >
      <Select
        id={field.name}
        invalid={Boolean(error)}
        disabled={disabled || !enabled || loading}
        placeholder={
          !enabled
            ? `Choose ${source.dependsOn} first`
            : loading
              ? 'Loading…'
              : `Select ${field.label.toLowerCase()}`
        }
        {...form.register(field.name, {
          required: field.required ? `${field.label} is required.` : false,
        })}
      >
        {options.map((option) => (
          <option key={String(option[source.valueKey])} value={String(option[source.valueKey])}>
            {String(option[source.labelKey])}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/* ------------------------------------------------------------------ *
 * Field renderer
 * ------------------------------------------------------------------ */

export function CrudFieldControl({
  field,
  form,
  mode,
}: {
  field: CrudField;
  form: UseFormReturn<FieldValues>;
  mode: 'create' | 'edit';
}) {
  if (field.only && field.only !== mode) return null;

  const locked = field.lockedValue !== undefined && field.lockedValue !== null;
  const error = form.formState.errors[field.name]?.message as string | undefined;

  if (field.source) return <SourceSelect field={field} form={form} disabled={locked} />;

  /* RegisterOptions is a discriminated union (valueAsNumber excludes pattern),
     so a dynamically assembled rule set has to be asserted into it. The
     branches below are mutually exclusive at runtime. */
  const rules = {
    required: field.required ? `${field.label} is required.` : false,
    ...(field.type === 'email'
      ? {
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
            message: 'Enter a valid email address.',
          },
        }
      : {}),
    ...(field.type === 'tel'
      ? {
          pattern: {
            value: /^[+\d][\d\s-]{7,19}$/,
            message: 'Enter a valid phone number.',
          },
        }
      : {}),
    ...(field.type === 'number'
      ? {
          valueAsNumber: true,
          ...(field.min !== undefined ? { min: { value: field.min, message: `Minimum ${field.min}.` } } : {}),
          ...(field.max !== undefined ? { max: { value: field.max, message: `Maximum ${field.max}.` } } : {}),
        }
      : {}),
    ...(field.maxLength ? { maxLength: { value: field.maxLength, message: `At most ${field.maxLength} characters.` } } : {}),
  } as RegisterOptions<FieldValues, string>;

  if (field.type === 'checkbox') {
    return (
      <div className={field.span === 2 ? 'sm:col-span-2' : undefined}>
        <Checkbox
          id={field.name}
          label={field.label}
          description={typeof field.hint === 'string' ? field.hint : undefined}
          {...form.register(field.name)}
        />
      </div>
    );
  }

  const shared = {
    id: field.name,
    invalid: Boolean(error),
    placeholder: field.placeholder,
    disabled: locked,
  };

  return (
    <Field
      label={field.label}
      htmlFor={field.name}
      required={field.required}
      hint={locked ? field.lockedReason : field.hint}
      error={error}
      className={field.span === 2 ? 'sm:col-span-2' : undefined}
    >
      {field.type === 'textarea' ? (
        <Textarea {...shared} rows={6} {...form.register(field.name, rules)} />
      ) : field.type === 'select' ? (
        <Select {...shared} placeholder={`Select ${field.label.toLowerCase()}`} {...form.register(field.name, rules)}>
          {(field.options ?? []).map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          {...shared}
          type={field.type}
          min={field.min}
          max={field.max}
          {...form.register(field.name, rules)}
        />
      )}
    </Field>
  );
}

/* ------------------------------------------------------------------ *
 * The dialog
 * ------------------------------------------------------------------ */

export function CrudForm<T extends Record<string, unknown>>({
  open,
  onClose,
  onSaved,
  record,
  fields,
  resource,
  idField,
  title,
  description,
  size = 'md',
  transform,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  record: T | null;
  fields: CrudField[];
  resource: Resource<T>;
  /** Primary-key property name, e.g. 'groupId'. */
  idField: string;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Last chance to reshape the payload before it is sent. */
  transform?: (values: FieldValues) => Record<string, unknown>;
}) {
  const mode: 'create' | 'edit' = record ? 'edit' : 'create';
  const toast = useToast();
  const form = useForm<FieldValues>({ mode: 'onBlur' });
  const { run, saving, error, reset } = useMutation(
    async (payload: Record<string, unknown>) =>
      record
        ? resource.update(Number(record[idField]), payload as Partial<T>)
        : resource.create(payload as Partial<T>),
  );

  /* Seed the form each time the dialog opens. */
  useEffect(() => {
    if (!open) return;
    reset();

    const defaults: FieldValues = {};
    for (const field of fields) {
      const existing = record ? (record as Record<string, unknown>)[field.name] : undefined;
      if (field.lockedValue !== undefined && field.lockedValue !== null) {
        defaults[field.name] = field.lockedValue;
      } else if (existing !== undefined && existing !== null) {
        defaults[field.name] = field.type === 'checkbox' ? Boolean(existing) : String(existing);
      } else {
        defaults[field.name] =
          field.defaultValue ?? (field.type === 'checkbox' ? true : '');
      }
    }
    form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const submit = form.handleSubmit(async (values) => {
    /* Empty strings must become null, not "" — a FK of "" fails on the server. */
    const cleaned: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.only && field.only !== mode) continue;
      const raw = values[field.name];
      if (field.type === 'checkbox') {
        cleaned[field.name] = Boolean(raw);
      } else if (raw === '' || raw === undefined) {
        cleaned[field.name] = field.required ? raw : null;
      } else if (field.type === 'number' || field.source || field.name.endsWith('Id')) {
        const numeric = Number(raw);
        cleaned[field.name] = Number.isFinite(numeric) ? numeric : raw;
      } else {
        cleaned[field.name] = raw;
      }
    }

    try {
      await run(transform ? transform(cleaned) : cleaned);
      toast.success(record ? 'Changes saved' : 'Record created', title);
      onSaved();
      onClose();
    } catch (cause) {
      /* Map ModelState errors back onto the fields that caused them. */
      if (cause instanceof ApiError) {
        for (const [name, message] of Object.entries(cause.fieldErrors)) {
          if (fields.some((f) => f.name === name)) {
            form.setError(name, { type: 'server', message });
          }
        }
      }
    }
  });

  const visible = fields.filter((f) => !f.only || f.only === mode);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? `Edit ${title}` : `New ${title}`}
      description={description}
      size={size}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="solar" size="sm" onClick={submit} loading={saving}>
            {record ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        {error && !Object.keys(error.fieldErrors).length && (
          <div className="mb-4">
            <ErrorPanel message={error.message} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((field) => (
            <CrudFieldControl key={field.name} field={field} form={form} mode={mode} />
          ))}
        </div>

        {/* Lets Enter submit from any text input. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * The screen
 * ------------------------------------------------------------------ */

export interface CrudScreenProps<T extends Record<string, unknown>> {
  eyebrow: string;
  title: string;
  description?: string;
  /** Singular noun used in the dialog title and toasts. */
  entity: string;
  resource: Resource<T>;
  idField: string;
  columns: Column<T>[];
  fields: CrudField[];
  capability: Capability;
  searchPlaceholder?: string;
  /** Always-applied query, merged before the user's filters. */
  baseQuery?: ListQuery;
  /** Field the Event Team's sub-group scope pins, if any. */
  scopeField?: string;
  dialogSize?: 'sm' | 'md' | 'lg' | 'xl';
  /** Extra filter controls rendered into the toolbar. */
  filters?: ReactNode;
  /** Screen-specific row controls, rendered before Edit and Deactivate. */
  rowActions?: (row: T) => ReactNode;
  transform?: (values: FieldValues) => Record<string, unknown>;
}

export function CrudScreen<T extends Record<string, unknown>>({
  eyebrow,
  title,
  description,
  entity,
  resource,
  idField,
  columns,
  fields,
  capability,
  searchPlaceholder = 'Search…',
  baseQuery,
  scopeField,
  dialogSize = 'md',
  filters,
  rowActions,
  transform,
}: CrudScreenProps<T>) {
  const { can, scope } = useAuth();
  const toast = useToast();
  const paging = usePaging();

  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<T | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<T | null>(null);

  const debouncedSearch = useDebounced(search);

  /* A parent-controlled filter that changes must not leave us stranded on
     page 7 of a result set that now has two pages. */
  const baseQueryKey = JSON.stringify(baseQuery ?? {});
  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueryKey]);

  /* An Event Team user's queries are pinned to their own sub-group. */
  const scopeQuery = scopeField && scope.subGroupId ? { [scopeField]: scope.subGroupId } : {};

  const query: ListQuery = {
    ...baseQuery,
    ...scopeQuery,
    page: paging.page,
    pageSize: paging.pageSize,
    search: debouncedSearch || undefined,
    ...(activeOnly === 'all' ? {} : { isActive: activeOnly === 'active' }),
  };

  const { items, total, loading, error, refresh } = useList(resource, query);

  const deactivate = useMutation(async (id: number) => resource.deactivate(id));

  const openCreate = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((row: T) => {
    setEditing(row);
    setDialogOpen(true);
  }, []);

  const confirmDeactivate = async () => {
    if (!pendingDeactivate) return;
    try {
      await deactivate.run(Number(pendingDeactivate[idField]));
      toast.success(`${entity} deactivated`, 'The record is kept and can be reactivated.');
      setPendingDeactivate(null);
      refresh();
    } catch (cause) {
      toast.error('Could not deactivate', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  const reactivate = async (row: T) => {
    try {
      await resource.update(Number(row[idField]), { isActive: true } as unknown as Partial<T>);
      toast.success(`${entity} reactivated`);
      refresh();
    } catch (cause) {
      toast.error('Could not reactivate', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  /* Pin and lock the scope field inside the dialog too. */
  const dialogFields = fields.map((field) =>
    scopeField && field.name === scopeField && scope.subGroupId
      ? {
          ...field,
          lockedValue: scope.subGroupId,
          lockedReason: 'Fixed to your assigned sub-group',
        }
      : field,
  );

  const canCreate = can(capability, 'create');
  const canEdit = can(capability, 'edit');
  const canDeactivate = can(capability, 'deactivate');

  const columnsWithStatus: Column<T>[] = [
    ...columns,
    {
      key: 'isActive',
      header: 'Status',
      align: 'right',
      render: (row) => <ActiveFlag isActive={Boolean(row.isActive)} />,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          canCreate ? (
            <Button variant="solar" size="sm" onClick={openCreate} icon={<span aria-hidden="true">＋</span>}>
              New {entity.toLowerCase()}
            </Button>
          ) : null
        }
      />

      <Toolbar>
        <Field label="Search" htmlFor="crud-search" className="w-full sm:w-72">
          <Input
            id="crud-search"
            type="search"
            value={search}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              setSearch(event.target.value);
              paging.reset();
            }}
          />
        </Field>

        <Field label="Record status" htmlFor="crud-status" className="w-full sm:w-44">
          <Select
            id="crud-status"
            value={activeOnly}
            onChange={(event) => {
              setActiveOnly(event.target.value as typeof activeOnly);
              paging.reset();
            }}
          >
            <option value="all">All records</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </Select>
        </Field>

        {filters}
      </Toolbar>

      <div className="glass overflow-hidden rounded-2xl">
        <DataTable
          columns={columnsWithStatus}
          rows={items}
          rowKey={(row) => Number(row[idField])}
          loading={loading}
          error={error}
          onRetry={refresh}
          emptyTitle={`No ${entity.toLowerCase()} records`}
          emptyDescription={
            debouncedSearch
              ? 'Nothing matched that search. Try a shorter term.'
              : `Create the first ${entity.toLowerCase()} to get started.`
          }
          emptyAction={
            canCreate && !debouncedSearch ? (
              <Button variant="solar" size="sm" onClick={openCreate}>
                New {entity.toLowerCase()}
              </Button>
            ) : null
          }
          actions={(row) => (
            <>
              {rowActions?.(row)}
              {canEdit && (
                <Button variant="subtle" size="sm" onClick={() => openEdit(row)}>
                  Edit
                </Button>
              )}
              {canDeactivate &&
                (row.isActive ? (
                  <Button variant="danger" size="sm" onClick={() => setPendingDeactivate(row)}>
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="subtle" size="sm" onClick={() => void reactivate(row)}>
                    Reactivate
                  </Button>
                ))}
            </>
          )}
        />
        <Pagination page={paging.page} pageSize={paging.pageSize} total={total} onPageChange={paging.setPage} />
      </div>

      <CrudForm
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
        record={editing}
        fields={dialogFields}
        resource={resource}
        idField={idField}
        title={entity}
        size={dialogSize}
        transform={transform}
      />

      <ConfirmDialog
        open={Boolean(pendingDeactivate)}
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => void confirmDeactivate()}
        loading={deactivate.saving}
        title={`Deactivate this ${entity.toLowerCase()}?`}
        confirmLabel="Deactivate"
        message={
          <>
            <p>
              The record is <strong className="text-fg">not deleted</strong>. It is flagged
              inactive, stays in reports and history, and can be reactivated at any time.
            </p>
            <p className="mt-2 text-fg/68">
              While inactive it cannot be selected for any new transaction.
            </p>
          </>
        }
      />
    </>
  );
}
