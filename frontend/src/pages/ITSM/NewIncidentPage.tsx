import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { createTicket } from '../../api/itsmApi';
import {
  CATEGORIES,
  CHANNELS,
  GROUPS,
  LEVELS,
  NO_FIELDS,
  Inp,
  Row,
  Sel,
  control,
  derivedPriority,
  fieldsKey,
  type Fields,
} from './IncidentFormPage';

const PRIORITY_BY_LABEL: Record<string, string> = {
  '1 - Critical': 'CRITICAL',
  '2 - High': 'HIGH',
  '3 - Moderate': 'MEDIUM',
  '4 - Low': 'LOW',
};

const actionBtn =
  'rounded border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white';

/** Blank incident form: same fields as the incident details page, empty. */
export default function NewIncidentPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [fields, setFields] = useState<Fields>(NO_FIELDS);
  const [number, setNumber] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Fields) => (v: string) =>
    setFields((f) => (k === 'category' ? { ...f, category: v, subcategory: '' } : { ...f, [k]: v }));

  const priority = derivedPriority(fields.impact, fields.urgency);

  const submit = async () => {
    if (!shortDescription.trim()) return setError('Short description is required.');
    setBusy(true);
    setError(null);
    try {
      // The backend only stores title, description, priority, category and assignee;
      // the remaining fields are kept in this browser, as on the incident details page.
      const ticket = await createTicket({
        title: shortDescription.trim(),
        description,
        priority: priority ? PRIORITY_BY_LABEL[priority] : 'MEDIUM',
        category: 'Incident',
        assignedTo: fields.assignedTo || undefined,
        ticketCode: number.trim() || undefined,
      });
      try {
        localStorage.setItem(fieldsKey(ticket.id), JSON.stringify(fields));
      } catch {
        /* storage unavailable: the extra fields are lost, the incident is still created */
      }
      dispatch(fetchTickets());
      navigate(`/tickets/incidents/${ticket.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create the incident');
      setBusy(false);
    }
  };

  return (
    <div className="-mx-1 [&_input]:!py-1 [&_select]:!py-1 [&_textarea]:!py-1 [&_input]:!text-[11px] [&_select]:!text-[11px] [&_textarea]:!text-[11px] [&_label]:!text-[11px] [&_button]:!text-[11px]">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={() => navigate('/tickets/incidents')} aria-label="Back to incidents" className={actionBtn}>
          ← Back
        </button>
        <h1 className="text-[15px] font-semibold text-slate-800">New Incident</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate('/tickets/incidents')} className={actionBtn}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded bg-primary-600 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>

      {error && <p className="bg-red-50 px-4 py-2 text-[13px] text-red-600">{error}</p>}

      <div className="grid gap-x-10 gap-y-3 bg-white p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Row label="Number">
            <Inp value={number} onChange={setNumber} placeholder="Auto-generated if left blank" />
          </Row>
          <Row label="Caller">
            <Inp value={fields.caller} onChange={set('caller')} />
          </Row>
          <Row label="Category">
            <Sel value={fields.category} onChange={set('category')} options={Object.keys(CATEGORIES)} />
          </Row>
          <Row label="Subcategory">
            <Sel value={fields.subcategory} onChange={set('subcategory')} options={CATEGORIES[fields.category] ?? []} />
          </Row>
          <Row label="Service">
            <Inp value={fields.service} onChange={set('service')} />
          </Row>
          <Row label="Service offering">
            <Inp value={fields.serviceOffering} onChange={set('serviceOffering')} />
          </Row>
          <Row label="Configuration item">
            <Inp value={fields.ci} onChange={set('ci')} />
          </Row>
        </div>

        <div className="space-y-3">
          <Row label="Channel">
            <Sel value={fields.channel} onChange={set('channel')} options={CHANNELS} />
          </Row>
          <Row label="State">
            <input disabled value="New" className={control} />
          </Row>
          <Row label="Impact">
            <Sel value={fields.impact} onChange={set('impact')} options={LEVELS} />
          </Row>
          <Row label="Urgency">
            <Sel value={fields.urgency} onChange={set('urgency')} options={LEVELS} />
          </Row>
          <Row label="Priority">
            <input disabled value={priority ?? '3 - Moderate'} className={control} />
          </Row>
          <Row label="Assignment group">
            <Sel value={fields.assignmentGroup} onChange={set('assignmentGroup')} options={GROUPS} />
          </Row>
          <Row label="Assigned to">
            <Inp value={fields.assignedTo} onChange={set('assignedTo')} />
          </Row>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Row label="Short description" required>
            <Inp value={shortDescription} onChange={setShortDescription} />
          </Row>
          <Row label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={control} />
          </Row>
        </div>
      </div>
    </div>
  );
}
