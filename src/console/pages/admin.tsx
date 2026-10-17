import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError, type RolePermission } from '@/api';
import { ACTIONS, CAPABILITIES, type Capability, type CapabilityAction, type Role } from '@/api/types';
import { ROLE_LABELS } from '@/rbac/matrix';
import { useToast } from '@/hooks/useToast';
import { useDebounced, useList, useMutation, usePaging } from '@/hooks/useResource';
import { DataTable, Pagination, Toolbar, type Column } from '@/ui/DataTable';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorPanel,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@/ui/primitives';
import { DURATION, EASE } from '@/lib/motion.js';

/* ------------------------------------------------------------------ *
 * Form 13 — RolePermission
 * ------------------------------------------------------------------ */

const CAPABILITY_LABELS: Record<Capability, string> = {
  dashboard: 'Dashboard',
  participants: 'Participant register',
  integration: 'Classification',
  masters: 'Master setup',
  teams: 'Teams',
  formations: 'Team formation',
  teamBuilder: 'Team builder',
  allocation: 'Team allocation',
  teamGroups: 'Team groups',
  events: 'Event scheduling',
  schedule: 'Match scheduling',
  results: 'Results & winners',
  rules: 'Rule cards',
  users: 'User accounts',
  permissions: 'Role rights',
  audit: 'Audit log',
  exports: 'Exports & history',
};

const ACTION_LABELS: Record<CapabilityAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  deactivate: 'Deactivate',
};

/**
 * The Section 07 matrix, editable.
 *
 * Changing a box here changes what the interface offers. It does NOT change what
 * the server allows — that is the point of the warning on this page. Both sides
 * have to agree, and the server is the one that counts.
 */
export function PermissionsPage() {
  const toast = useToast();
  const { items, loading, error, refresh } = useList(api.rolePermissions, { pageSize: 50 });
  const [draft, setDraft] = useState<Record<number, RolePermission['permissions']>>({});

  useEffect(() => {
    const next: Record<number, RolePermission['permissions']> = {};
    for (const role of items) {
      next[role.rolePermissionId] = structuredClone(role.permissions);
    }
    setDraft(next);
  }, [items]);

  const save = useMutation(async (role: RolePermission) =>
    api.rolePermissions.update(role.rolePermissionId, {
      permissions: draft[role.rolePermissionId],
    }),
  );

  const toggle = (roleId: number, capability: Capability, action: CapabilityAction) => {
    setDraft((current) => {
      const role = current[roleId];
      if (!role) return current;
      const next = structuredClone(role);
      const grant = next[capability];
      grant[action] = !grant[action];
      /* Turning off view turns everything off — you cannot edit what you cannot see. */
      if (action === 'view' && !grant.view) {
        grant.create = false;
        grant.edit = false;
        grant.deactivate = false;
      }
      /* Any write implies view. */
      if (action !== 'view' && grant[action]) grant.view = true;
      return { ...current, [roleId]: next };
    });
  };

  const persist = async (role: RolePermission) => {
    try {
      await save.run(role);
      toast.success(`${role.roleName} permissions saved`);
      refresh();
    } catch (cause) {
      toast.error('Could not save', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Role permissions"
        description="What each role is offered in the interface. Scope is separate: a Main Admin sees everything, while Management Team and Event Management users see only their assigned sub-group."
      />

      <div className="mb-5 rounded-xl border border-solar-600/35 bg-solar-600/[0.07] px-4 py-3.5">
        <p className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-fg/86">
          <span aria-hidden="true" className="mt-px text-accent-solar">
            ⚿
          </span>
          <span>
            <strong className="text-fg">This controls the interface, not the server.</strong> A
            hidden menu item is not a permission. The same matrix must be enforced on every API
            action, or a hand-crafted request will simply bypass it.
          </span>
        </p>
      </div>

      {error && (
        <div className="mb-5">
          <ErrorPanel message={error.message} onRetry={refresh} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-fg/62">
          <Spinner size={18} />
          <span className="text-[13.5px]">Loading roles…</span>
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((role) => {
            const permissions = draft[role.rolePermissionId];
            if (!permissions) return null;

            return (
              <motion.div
                key={role.rolePermissionId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.base, ease: EASE.luxe }}
              >
                <Card
                  title={
                    <div className="flex items-center gap-3">
                      <h2 className="text-[15.5px] font-semibold text-fg">
                        {ROLE_LABELS[role.roleName as Role] ?? role.roleName}
                      </h2>
                      <Badge tone={role.scopeType === 'Global' ? 'success' : 'info'} glyph="◆">
                        {role.scopeType === 'Global' ? 'Global scope' : 'Sub-group scope'}
                      </Badge>
                    </div>
                  }
                  action={
                    <Button variant="solar" size="sm" loading={save.saving} onClick={() => void persist(role)}>
                      Save
                    </Button>
                  }
                >
                  <div className="scroll-hint-x overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
                      <thead>
                        <tr>
                          <th scope="col" className="border-b border-fg/18 px-3 py-2.5 text-left text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/72">
                            Capability
                          </th>
                          {ACTIONS.map((action) => (
                            <th
                              key={action}
                              scope="col"
                              className="border-b border-fg/18 px-3 py-2.5 text-center text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg/72"
                            >
                              {ACTION_LABELS[action]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CAPABILITIES.map((capability) => (
                          <tr key={capability} className="border-b border-fg/12 last:border-b-0">
                            <th scope="row" className="px-3 py-2 text-left font-medium text-fg/88">
                              {CAPABILITY_LABELS[capability]}
                            </th>
                            {ACTIONS.map((action) => {
                              const granted = permissions[capability][action];
                              return (
                                <td key={action} className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={granted}
                                    aria-label={`${ACTION_LABELS[action]} ${CAPABILITY_LABELS[capability]} for ${role.roleName}`}
                                    onClick={() => toggle(role.rolePermissionId, capability, action)}
                                    className={`grid h-6 w-6 place-items-center rounded-md border coarse:h-9 coarse:w-9 text-[12px] transition-colors ${
                                      granted
                                        ? 'border-phthalo-400 bg-phthalo-500/25 text-accent-phthalo'
                                        : 'border-fg/18 text-fg/20 hover:border-fg/38'
                                    }`}
                                  >
                                    {granted ? '✓' : '·'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Audit log — read-only
 * ------------------------------------------------------------------ */

const ACTION_TONES: Record<string, { tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; glyph: string }> = {
  Create: { tone: 'success', glyph: '＋' },
  Update: { tone: 'info', glyph: '✎' },
  Activate: { tone: 'success', glyph: '●' },
  Deactivate: { tone: 'warning', glyph: '○' },
  Login: { tone: 'neutral', glyph: '→' },
  Logout: { tone: 'neutral', glyph: '←' },
  Export: { tone: 'info', glyph: '↧' },
};

export function AuditPage() {
  const paging = usePaging(20);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const debouncedSearch = useDebounced(search);

  const { items, total, loading, error, refresh } = useList(api.auditLogs, {
    page: paging.page,
    pageSize: paging.pageSize,
    search: debouncedSearch || undefined,
    ...(action ? { action } : {}),
    sortBy: 'timestamp',
    sortDir: 'desc',
  });

  const columns: Column<(typeof items)[number]>[] = [
    {
      key: 'action',
      header: 'Action',
      primary: true,
      render: (r) => {
        const meta = ACTION_TONES[r.action] ?? { tone: 'neutral' as const, glyph: '·' };
        return (
          <Badge tone={meta.tone} glyph={meta.glyph}>
            {r.action}
          </Badge>
        );
      },
    },
    { key: 'entityName', header: 'Record', render: (r) => <span className="font-mono text-[12.5px]">{r.entityName}{r.entityId ? ` #${r.entityId}` : ''}</span> },
    { key: 'details', header: 'Detail', render: (r) => <span className="text-[13px]">{r.details ?? '—'}</span> },
    { key: 'userName', header: 'By', render: (r) => <span className="font-mono text-[12.5px] text-fg/78">{r.userName}</span> },
    {
      key: 'timestamp',
      header: 'When',
      align: 'right',
      render: (r) => (
        <span className="whitespace-nowrap font-mono text-[12.5px] text-fg/72">
          {String(r.timestamp).replace('T', ' ').slice(0, 16)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Who changed what, and when. Written by the server on every privileged action — read-only here, by design."
      />

      <Toolbar>
        <Field label="Search" htmlFor="audit-search" className="w-full sm:w-72">
          <Input
            id="audit-search"
            type="search"
            value={search}
            placeholder="Search record, user or detail…"
            onChange={(event) => {
              setSearch(event.target.value);
              paging.reset();
            }}
          />
        </Field>

        <Field label="Action" htmlFor="audit-action" className="w-full sm:w-44">
          <Select
            id="audit-action"
            value={action}
            placeholder="Any action"
            onChange={(event) => {
              setAction(event.target.value);
              paging.reset();
            }}
          >
            {Object.keys(ACTION_TONES).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      </Toolbar>

      <div className="glass overflow-hidden rounded-2xl">
        {!loading && !items.length ? (
          <EmptyState glyph="◷" title="No audit entries" description="Activity will appear here as records are created and changed." />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(r) => r.auditId}
              loading={loading}
              error={error}
              onRetry={refresh}
            />
            <Pagination page={paging.page} pageSize={paging.pageSize} total={total} onPageChange={paging.setPage} />
          </>
        )}
      </div>
    </>
  );
}
