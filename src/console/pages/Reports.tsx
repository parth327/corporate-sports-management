import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError, downloadReport, type ExportFormat, type ExportRequest } from '@/api';
import { EXPORT_FORMATS } from '@/api/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useMutation, useOptions } from '@/hooks/useResource';
import { Badge, Button, Card, ErrorPanel, Field, PageHeader, Select } from '@/ui/primitives';
import { DURATION, EASE } from '@/lib/motion.js';

/**
 * Form 24 — export and dashboard filter.
 *
 * The filter panel and the report share one set of parameters, because the most
 * common source of mistrust in reporting is a downloaded file whose numbers do
 * not match the screen it came from. The same filters are sent to the export
 * endpoint that would be sent to the dashboard.
 */

interface ReportDefinition {
  type: ExportRequest['reportType'];
  title: string;
  description: string;
  formats: ExportFormat[];
  glyph: string;
}

const REPORTS: ReportDefinition[] = [
  {
    type: 'playerMaster',
    title: 'Participant master',
    description: 'Every participant with status and the full classification path.',
    formats: ['XLS', 'PDF', 'CSV'],
    glyph: '◈',
  },
  {
    type: 'teamRoster',
    title: 'Team roster',
    description: 'Team, allocated participants and capacity utilisation.',
    formats: ['XLS', 'PDF', 'CSV'],
    glyph: '⬢',
  },
  {
    type: 'teamGroups',
    title: 'Team groups',
    description: 'Group A and Group B with their team membership.',
    formats: ['XLS', 'PDF', 'CSV'],
    glyph: '◇',
  },
  {
    type: 'matchSchedule',
    title: 'Match schedule',
    description: 'Date, time, match number, teams, officials and overs.',
    formats: ['XLS', 'PDF', 'CSV'],
    glyph: '▤',
  },
  {
    type: 'rules',
    title: 'Rule cards',
    description: 'Playing conditions presented by sub-group.',
    formats: ['PDF', 'XLS', 'CSV'],
    glyph: '§',
  },
  {
    type: 'dashboardSnapshot',
    title: 'Dashboard snapshot',
    description: 'KPI figures and chart values, with the filters that produced them.',
    formats: ['PDF'],
    glyph: '◫',
  },
];

export default function ReportsPage() {
  const { isGlobal, scope, user } = useAuth();
  const toast = useToast();

  const [subGroupId, setSubGroupId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { options: subGroups } = useOptions(api.subGroups, {}, { enabled: isGlobal });

  const effectiveSubGroup = isGlobal ? (subGroupId ? Number(subGroupId) : null) : (scope.subGroupId ?? null);

  const { options: teams } = useOptions(
    api.teams,
    { subGroupId: effectiveSubGroup ?? undefined },
    { enabled: Boolean(effectiveSubGroup) },
  );

  const exportMutation = useMutation(async (payload: ExportRequest) => downloadReport(payload));

  const run = async (report: ReportDefinition, format: ExportFormat) => {
    const key = `${report.type}:${format}`;
    setBusy(key);
    try {
      await exportMutation.run({
        reportType: report.type,
        format,
        filters: {
          subGroupId: effectiveSubGroup,
          teamId: teamId ? Number(teamId) : null,
        },
      });
      toast.success(`${report.title} exported`, `Downloaded as ${format}.`);
    } catch (cause) {
      toast.error('Export failed', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Exports"
        description="Every export is generated from the same filtered dataset that produces the on-screen view, so the numbers always reconcile."
        actions={
          !isGlobal && user?.subGroupName ? (
            <Badge tone="info" glyph="◆">
              Scoped to {user.subGroupName}
            </Badge>
          ) : null
        }
      />

      <Card title="Filters" className="mb-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Sub-group"
            htmlFor="rpt-subgroup"
            hint={isGlobal ? undefined : 'Fixed to your assigned sub-group'}
          >
            <Select
              id="rpt-subgroup"
              value={isGlobal ? subGroupId : String(scope.subGroupId ?? '')}
              disabled={!isGlobal}
              placeholder="All sub-groups"
              onChange={(event) => {
                setSubGroupId(event.target.value);
                setTeamId('');
              }}
            >
              {(isGlobal ? subGroups : []).map((s) => (
                <option key={s.subGroupId} value={String(s.subGroupId)}>
                  {s.subGroupName}
                </option>
              ))}
              {!isGlobal && user?.subGroupName && (
                <option value={String(scope.subGroupId ?? '')}>{user.subGroupName}</option>
              )}
            </Select>
          </Field>

          <Field label="Team" htmlFor="rpt-team" hint="Applies to the roster report">
            <Select
              id="rpt-team"
              value={teamId}
              placeholder={effectiveSubGroup ? 'All teams' : 'Choose a sub-group first'}
              disabled={!effectiveSubGroup}
              onChange={(event) => setTeamId(event.target.value)}
            >
              {teams.map((t) => (
                <option key={t.teamId} value={String(t.teamId)}>
                  {t.teamName}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end">
            <p className="text-[12.5px] leading-relaxed text-fg/62">
              Filters apply to every report below. Leave them empty for the widest scope you are
              permitted.
            </p>
          </div>
        </div>
      </Card>

      {exportMutation.error && (
        <div className="mb-5">
          <ErrorPanel message={exportMutation.error.message} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report, index) => (
          <motion.div
            key={report.type}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE.luxe, delay: index * 0.05 }}
            whileHover={{ y: -3 }}
            className="glass flex flex-col rounded-2xl p-5"
          >
            <span
              aria-hidden="true"
              className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-fg/16 bg-fg/[0.06] text-[15.5px] text-fg/78"
            >
              {report.glyph}
            </span>

            <h2 className="text-[15.5px] font-semibold text-fg">{report.title}</h2>
            <p className="mt-1.5 min-h-[2.5rem] flex-1 text-[13px] leading-relaxed text-fg/68">
              {report.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {report.formats.map((format) => {
                const key = `${report.type}:${format}`;
                return (
                  <Button
                    key={format}
                    variant="subtle"
                    size="sm"
                    loading={busy === key}
                    disabled={busy !== null && busy !== key}
                    onClick={() => void run(report, format)}
                  >
                    {format}
                  </Button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <Card title="Export pattern" className="mt-5">
        <ol className="flex flex-wrap items-center gap-2 text-[13.5px]">
          {['Filter', 'Preview', 'Generate', 'Download'].map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-lg border border-fg/16 bg-fg/[0.05] px-3.5 py-2 text-fg/86">
                <span className="mr-1.5 font-mono text-[12px] text-accent-solar">{index + 1}</span>
                {step}
              </span>
              {index < 3 && (
                <span aria-hidden="true" className="text-fg/45">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] leading-relaxed text-fg/62">
          Supported formats: {EXPORT_FORMATS.join(' · ')}. In the demo build every format is
          generated as delimited text so the download path is genuinely exercised; the production API
          returns a real workbook or PDF from the same endpoint.
        </p>
      </Card>
    </>
  );
}
