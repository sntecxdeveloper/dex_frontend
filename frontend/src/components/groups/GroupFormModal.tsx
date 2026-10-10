import { useState } from 'react';
import { motion } from 'framer-motion';
import { createGroup, updateGroup } from '../../api/groupApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { GROUP_COLORS, KINDS, KIND_INFO } from './groupMeta';
import type { GroupDetail, GroupKind } from '../../types/group';

const field =
  'h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface Props {
  /** Present when editing an existing group. */
  existing?: GroupDetail;
  onClose: () => void;
  onSaved: (group: GroupDetail) => void;
}

/**
 * Create or edit a group. A group is just a named unit with an optional kind. What is inside it (devices, technicians,
 * users) is added afterwards, from the group itself.
 */
export default function GroupFormModal({ existing, onClose, onSaved }: Props) {
  const editing = !!existing;
  const [name, setName] = useState(existing?.summary.name ?? '');
  const [description, setDescription] = useState(existing?.summary.description ?? '');
  const [kind, setKind] = useState<GroupKind>(existing?.summary.kind ?? 'DEPARTMENT');
  const [color, setColor] = useState(existing?.summary.color ?? GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        kind,
        color,
        // keep how devices are chosen exactly as it was
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
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl"
      >
        <div className="space-y-4 p-6">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary-500">{editing ? 'Edit group' : 'New group'}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{editing ? existing.summary.name : 'Create a group'}</h2>
            {!editing && <p className="mt-1 text-xs text-slate-500">Name it first. You add its devices, technicians and users from inside the group.</p>}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="For example: Finance department" className={field} autoFocus />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kind</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as GroupKind)} className={field}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_INFO[k].label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description (optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="What is this group for?" className={field} />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Colour</span>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  className={`h-7 w-7 rounded-full ring-offset-2 transition-all ${color === c ? 'ring-2 ring-slate-700' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

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
