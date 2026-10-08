import { useState } from 'react';
import { motion } from 'framer-motion';
import { createGroup, updateGroup } from '../../api/groupApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { GROUP_TYPES, TYPE_INFO } from './groupMeta';
import type { GroupDetail, GroupStatus, GroupType } from '../../types/group';

const field =
  'h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
const label = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

interface Props {
  /** Present when editing an existing group. */
  existing?: GroupDetail;
  onClose: () => void;
  onSaved: (group: GroupDetail) => void;
}

/**
 * Create or edit a group: its name (Software, Hardware...), what it holds (a technician group by default), a description and
 * whether it is active. The technicians, users or devices are added afterwards, from inside the group.
 */
export default function GroupFormModal({ existing, onClose, onSaved }: Props) {
  const editing = !!existing;
  const [name, setName] = useState(existing?.summary.name ?? '');
  // an older group with no type stays general until someone picks one
  const [type, setType] = useState<GroupType | ''>(editing ? (existing.summary.type ?? '') : 'TECHNICIAN');
  const [description, setDescription] = useState(existing?.summary.description ?? '');
  const [status, setStatus] = useState<GroupStatus>(existing?.summary.status ?? 'ACTIVE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        status,
        // everything else about an existing group stays exactly as it was
        kind: existing?.summary.kind ?? 'CUSTOM',
        color: existing?.summary.color ?? undefined,
        membershipMode: existing?.summary.membershipMode ?? 'STATIC',
        rule: existing?.rule ?? null,
      } as const;
      const saved = editing ? await updateGroup(existing.summary.id, body) : await createGroup(body);
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const btn = 'px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit group' : 'New group'}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
      >
        <div className="space-y-4 p-6">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary-500">{editing ? 'Edit group' : 'New group'}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{editing ? existing.summary.name : 'Create a group'}</h2>
            {!editing && <p className="mt-1 text-xs text-slate-500">After creating it, open the group and add its members.</p>}
          </div>

          <label className="block">
            <span className={label}>Group name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="For example: Software" className={field} autoFocus />
          </label>

          <label className="block">
            <span className={label}>Group type</span>
            <select value={type} onChange={(e) => setType(e.target.value as GroupType | '')} className={field}>
              {editing && !existing.summary.type && <option value="">General (devices, technicians and users)</option>}
              {GROUP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_INFO[t].label}
                </option>
              ))}
            </select>
            {type && <span className="mt-1 block text-[11px] text-slate-500">{TYPE_INFO[type].blurb}</span>}
          </label>

          <label className="block">
            <span className={label}>Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Handles software-related incidents and requests"
              className={field}
            />
          </label>

          <label className="block">
            <span className={label}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as GroupStatus)} className={field}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            {status === 'INACTIVE' && <span className="mt-1 block text-[11px] text-slate-500">An inactive group can no longer be picked as a ticket's assignment group.</span>}
          </label>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              Cancel
            </button>
            <button type="button" disabled={!name.trim() || saving} onClick={() => void save()} className={`${btn} bg-primary-600 text-white hover:bg-primary-700`}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create group'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
