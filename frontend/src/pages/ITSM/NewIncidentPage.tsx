import { useEffect, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { nextTicketNumber } from '../../utils/ticketNumber';
import { getCategoryMap } from '../../utils/categoryStore';
import { formatSize, readAttachments, saveAttachments, type Attachment } from '../../utils/incidentAttachments';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { createTicket } from '../../api/itsmApi';
import { useAssignmentGroups } from '../../hooks/useAssignmentGroups';
import { emailTicketsWithTemplate } from '../../utils/ticketNotifications';
import {
  CHANNELS,
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
  const { tickets } = useAppSelector((s) => s.itsm);
  const number = nextTicketNumber(tickets, 'INC');
  const categories = getCategoryMap();
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendMail, setSendMail] = useState(true);
  const [extraRecipients, setExtraRecipients] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refresh the list so the next number is based on every existing incident.
  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  // Dropping on the description: text files are read into it, every other file becomes an attachment.
  // Attachments are kept in this browser (the backend has no attachment storage yet).
  const [dragging, setDragging] = useState(false);
  const [dropNote, setDropNote] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const MAX_TEXT_BYTES = 200_000;

  const attach = async (files: File[]) => {
    const { added, note } = await readAttachments(files, attachments);
    if (added.length) setAttachments((a) => [...a, ...added]);
    setDropNote(note);
  };

  const onDrop = async (e: DragEvent<HTMLElement>, textIntoDescription: boolean) => {
    const files = Array.from(e.dataTransfer.files);
    setDragging(false);
    if (files.length === 0) return; // plain text dragged from elsewhere: the browser inserts it itself
    e.preventDefault();
    const isText = (f: File) => f.type.startsWith('text/') || /\.(txt|log|md|json|csv|xml|ya?ml|ini|conf)$/i.test(f.name);
    const asText = textIntoDescription ? files.filter((f) => isText(f) && f.size <= MAX_TEXT_BYTES) : [];
    const rest = files.filter((f) => !asText.includes(f));
    if (asText.length) {
      const parts = await Promise.all(asText.map(async (f) => `--- ${f.name} ---\n${await f.text()}`));
      setDescription((d) => (d ? `${d}\n\n` : '') + parts.join('\n\n'));
    }
    if (rest.length) await attach(rest);
    else setDropNote(null);
  };
  const set = (k: keyof Fields) => (v: string) =>
    setFields((f) => (k === 'category' ? { ...f, category: v, subcategory: '' } : { ...f, [k]: v }));

  const priority = derivedPriority(fields.impact, fields.urgency);
  const assignmentGroups = useAssignmentGroups();

  const submit = async () => {
    if (!fields.requesterName.trim()) return setError('Requester name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.requesterEmail.trim())) return setError('Enter a valid requester email address.');
    const extra = extraRecipients.split(/[,;\s]+/).filter(Boolean);
    const badExtra = extra.find((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
    if (sendMail && badExtra) return setError(`Invalid additional email address: ${badExtra}`);
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
        category: fields.category || undefined,
        assignedTo: fields.assignedTo || undefined, requester: fields.requesterEmail.trim(),
        assignmentGroupId: assignmentGroups.find((g) => g.name === fields.assignmentGroup)?.id,
        ticketCode: number,
      });
      try {
        localStorage.setItem(fieldsKey(ticket.id), JSON.stringify(fields));
      } catch {
        /* storage unavailable: the extra fields are lost, the incident is still created */
      }
      // If the browser refuses the write (storage full), the incident is still created without them.
      saveAttachments(ticket.id, attachments);
      dispatch(fetchTickets());
      // Same send as "Notification template" on the Incidents list: the saved Mail ID (stored just above) plus any extras.
      const mailNote = !sendMail ? null : await emailTicketsWithTemplate([{ id: ticket.id }], 'TICKET_CREATED', undefined, extra);
      navigate(`/tickets/incidents/${ticket.id}`, { state: mailNote ? { mailNote } : undefined });
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
            <input disabled readOnly value={number} className={control} />
          </Row>
          <Row label="Requester name" required>
            <Inp value={fields.requesterName} onChange={set('requesterName')} />
          </Row>
          <Row label="Mail ID" required>
            <input
              type="email"
              value={fields.requesterEmail}
              onChange={(e) => set('requesterEmail')(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
              className={control}
            />
          </Row>
          <Row label="Category">
            <Sel value={fields.category} onChange={set('category')} options={Object.keys(categories)} />
          </Row>
          <Row label="Subcategory">
            <Sel value={fields.subcategory} onChange={set('subcategory')} options={categories[fields.category] ?? []} />
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
            <Sel value={fields.assignmentGroup} onChange={set('assignmentGroup')} options={assignmentGroups.map((g) => g.name)} />
          </Row>
          <Row label="Assigned to">
            <Inp value={fields.assignedTo} onChange={set('assignedTo')} />
          </Row>
        </div>

        <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3 lg:col-span-2">
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
            <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} className="h-4 w-4" />
            Send email notification when this incident is created
          </label>
          {sendMail && (
            <>
              <Row label="Additional recipients">
                <Inp value={extraRecipients} onChange={setExtraRecipients} />
              </Row>
              <p className="text-[12px] text-slate-500">
                Sent to the Mail ID above plus these addresses (separate with commas), using the active “Ticket created”
                template. Set it up in <Link to="/setup/automation/notification-templates" className="text-primary-600 underline">Notification Templates</Link>,{' '}
                <Link to="/setup/automation/notification-rules" className="text-primary-600 underline">Notification Rules</Link> and{' '}
                <Link to="/setup/mail/server" className="text-primary-600 underline">Mail Server Settings</Link>.
              </p>
            </>
          )}
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Row label="Short description" required>
            <Inp value={shortDescription} onChange={setShortDescription} />
          </Row>
          <Row label="Description">
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => void onDrop(e, true)}
                placeholder="Type here, or drag and drop files"
                rows={5}
                className={`${control} ${dragging ? '!border-primary-500 !bg-primary-50 ring-2 ring-primary-300' : ''}`}
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => void onDrop(e, false)}
                className={`mt-2 rounded border-2 border-dashed px-3 py-3 text-center text-[11px] ${
                  dragging ? 'border-primary-500 bg-primary-50' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <p className="text-slate-600">
                  Drag and drop files here, or{' '}
                  <label className="cursor-pointer font-medium text-primary-700 hover:underline">
                    browse
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void attach(Array.from(e.target.files ?? []));
                        e.target.value = '';
                      }}
                    />
                  </label>
                </p>
                <p className="mt-0.5 text-slate-400">Any file type, up to 1 MB each and 3 MB in total. Kept in this browser.</p>
              </div>
              {dropNote && <p className="mt-1 text-[11px] text-amber-600">{dropNote}</p>}
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((a, i) => (
                    <li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px]">
                      <span className="min-w-0 flex-1 truncate text-slate-800">{a.name}</span>
                      <span className="shrink-0 text-slate-400">{formatSize(a.size)}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
                        aria-label={`Remove ${a.name}`}
                        className="shrink-0 text-slate-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Row>
        </div>
      </div>
    </div>
  );
}
