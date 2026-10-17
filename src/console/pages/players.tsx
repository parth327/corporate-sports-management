import { useState } from 'react';
import { api, type PlayerMaster, type Resource } from '@/api';
import { PLAYER_STATUSES } from '@/api/types';
import {
  Button,
  Dash,
  Field,
  MailLink,
  PhoneLink,
  Select,
  StatusPill,
  WhatsAppLink,
} from '@/ui/primitives';
import { CrudScreen } from '../Crud';
import { PlayerCard } from '../PlayerCard';

const asSource = <T,>(resource: Resource<T>) => resource as unknown as Resource<Record<string, unknown>>;

/* ------------------------------------------------------------------ *
 * Form 16 — PlayerMaster, add / edit
 * ------------------------------------------------------------------ */

export function PlayersPage() {
  const [status, setStatus] = useState('');
  const [viewing, setViewing] = useState<PlayerMaster | null>(null);

  return (
    <>
    <CrudScreen<PlayerMaster & Record<string, unknown>>
      eyebrow="Participants"
      title="Participant register"
      entity="Participant"
      description="Everyone on the ACE roll, fed from the HR API. Classification is set here or on the assignment screens; the Main Admin can also add a record directly."
      resource={api.players as never}
      idField="playerId"
      capability="participants"
      scopeField="subGroupId"
      dialogSize="lg"
      searchPlaceholder="Search name, email or mobile…"
      baseQuery={status ? { status } : undefined}
      filters={
        <Field label="Review status" htmlFor="player-status" className="w-full sm:w-48">
          <Select
            id="player-status"
            value={status}
            placeholder="Any status"
            onChange={(event) => setStatus(event.target.value)}
          >
            {PLAYER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      }
      rowActions={(row) => (
        <Button variant="subtle" size="sm" onClick={() => setViewing(row)}>
          View card
        </Button>
      )}
      columns={[
        {
          key: 'name',
          header: 'Participant',
          primary: true,
          selfLinking: true,
          render: (r) => (
            <div className="min-w-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setViewing(r);
                }}
                className="block max-w-full truncate text-left font-semibold text-fg underline-offset-4 hover:underline coarse:-my-2.5 coarse:py-2.5"
              >
                {r.name}
              </button>
              <span className="block truncate text-[12px]">
                <MailLink email={r.email} />
              </span>
            </div>
          ),
        },
        { key: 'mobileNo', header: 'Mobile', render: (r) => <PhoneLink phone={r.mobileNo} /> },
        { key: 'whatsAppNo', header: 'WhatsApp', secondary: true, render: (r) => <WhatsAppLink phone={r.whatsAppNo} /> },
        {
          key: 'classification',
          header: 'Classification',
          render: (r) => {
            const path = [r.interest, r.subGroupName, r.playerSubTypeName, r.playerSubTypeDetailName].filter(Boolean);
            return <span className="text-[13px]">{path.join(' › ')}</span>;
          },
        },
        { key: 'department', header: 'Department', secondary: true, render: (r) => r.department || <Dash /> },
        { key: 'status', header: 'Review', render: (r) => <StatusPill status={r.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Full name', type: 'text', required: true, span: 2, maxLength: 120 },
        { name: 'mobileNo', label: 'Mobile number', type: 'tel', required: true },
        { name: 'whatsAppNo', label: 'WhatsApp number', type: 'tel' },
        { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
        {
          name: 'interest', label: 'Interest', type: 'select', required: true,
          options: [
            { value: 'Sports', label: 'Sports' },
            { value: 'Cultural', label: 'Cultural' },
            { value: 'None', label: 'None' },
          ],
        },
        {
          name: 'subGroupId', label: 'Sub-group', type: 'select',
          source: { resource: asSource(api.subGroups), valueKey: 'subGroupId', labelKey: 'subGroupName' },
        },
        {
          name: 'playerSubTypeId', label: 'Participant type', type: 'select',
          source: {
            resource: asSource(api.playerSubTypes),
            valueKey: 'playerSubTypeId',
            labelKey: 'subTypeName',
            dependsOn: 'subGroupId',
            query: (values) => ({ subGroupId: Number(values.subGroupId) || undefined }),
          },
        },
        {
          name: 'playerSubTypeDetailId', label: 'Sub-type detail', type: 'select',
          source: {
            resource: asSource(api.playerSubTypeDetails),
            valueKey: 'playerSubTypeDetailId',
            labelKey: 'detailName',
            dependsOn: 'playerSubTypeId',
            query: (values) => ({ playerSubTypeId: Number(values.playerSubTypeId) || undefined }),
          },
        },
        {
          name: 'status', label: 'Review status', type: 'select', required: true,
          options: PLAYER_STATUSES.map((value) => ({ value, label: value })),
        },
        {
          name: 'eventId', label: 'Event', type: 'select', required: true,
          source: { resource: asSource(api.events), valueKey: 'eventId', labelKey: 'eventName' },
        },
        { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
        {
          name: 'gender', label: 'Gender', type: 'select',
          options: [
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
            { value: 'Other', label: 'Other' },
          ],
        },
        { name: 'employeeCode', label: 'Employee code', type: 'text', maxLength: 30 },
        { name: 'department', label: 'Department', type: 'text', maxLength: 80 },
        {
          name: 'tShirtSize', label: 'T-shirt size', type: 'select',
          options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((value) => ({ value, label: value })),
        },
        { name: 'emergencyContactName', label: 'Emergency contact', type: 'text', maxLength: 120 },
        { name: 'emergencyContactNo', label: 'Emergency number', type: 'tel' },
        { name: 'medicalNotes', label: 'Medical notes', type: 'textarea', span: 2, maxLength: 1000 },
        { name: 'isActive', label: 'Record active', type: 'checkbox', span: 2 },
      ]}
    />

    <PlayerCard
      player={viewing}
      open={Boolean(viewing)}
      onClose={() => setViewing(null)}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
          Close
        </Button>
      }
    />
    </>
  );
}

/**
 * Form 17 — Player review & activate — removed.
 *
 * It reviewed self-registrations arriving with status Pending. Participants now
 * arrive Active from the HR feed, so there is no queue to work; the field it
 * edited, `status`, stays on the register above for a Main Admin who needs to
 * hand-correct a record.
 */
