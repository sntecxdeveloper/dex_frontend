import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { createGroup, getRuleFields, updateGroup } from '../../api/groupApi';
import { getErrorMessage } from '../../utils/errorHandler';
import RuleBuilder from './RuleBuilder';
import { EMPTY_RULE, ruleIsComplete } from './ruleUtils';
import { GROUP_COLORS, MODE_INFO, TYPE_INFO } from './groupMeta';
import type { GroupDetail, GroupRule, GroupType, MembershipMode, RuleFieldInfo } from '../../types/group';

const field =
  'h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface Props {
  /** Present when editing an existing group. */
  existing?: GroupDetail;
  defaultType?: GroupType;
  onClose: () => void;
  onSaved: (group: GroupDetail) => void;
}

function Tile({
  selected,
  disabled,
  title,
  blurb,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed ${
        selected ? 'border-primary-400 bg-primary-50/60 ring-2 ring-primary-500/20' : 'border-line bg-panel hover:border-line-strong'
      } ${disabled && !selected ? 'opacity-45' : ''}`}
    >
      <p className="text-[13px] font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{blurb}</p>
    </button>
  );
}

/** Create or edit a group: choose what it holds, how members are chosen, and (for dynamic groups) the rule. */
export default function GroupFormModal({ existing, defaultType = 'DEVICE', onClose, onSaved }: Props) {
  const editing = !!existing;
  const [type, setType] = useState<GroupType>(existing?.summary.groupType ?? defaultType);
  const [mode, setMode] = useState<MembershipMode>(existing?.summary.membershipMode ?? 'STATIC');
  const [name, setName] = useState(existing?.summary.name ?? '');
  const [description, setDescription] = useState(existing?.summary.description ?? '');
  const [color, setColor] = useState(existing?.summary.color ?? GROUP_COLORS[0]);
  const [rule, setRule] = useState<GroupRule>(existing?.rule ?? EMPTY_RULE);
  const [fields, setFields] = useState<RuleFieldInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The rule builder owns its own copy of the field list; this one only decides whether Save is allowed.
  useEffect(() => {
    let cancelled = false;
    getRuleFields(type).then((f) => !cancelled && setFields(f)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [type]);

  const changeType = (next: GroupType) => {
    if (editing || next === type) return;
    setType(next);
    setRule(EMPTY_RULE);   // fields differ between devices and people
  };

  const canSave = name.trim().length > 0 && (mode === 'STATIC' || ruleIsComplete(rule, fields)) && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        groupType: type,
        membershipMode: mode,
        rule: mode === 'DYNAMIC' ? rule : null,
        color,
      };
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
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="space-y-5 p-6">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary-500">{editing ? 'Edit group' : 'New group'}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{editing ? existing.summary.name : 'Create a group'}</h2>
          </div>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What does it hold?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(TYPE_INFO) as GroupType[]).map((t) => (
                <Tile key={t} selected={type === t} disabled={editing} title={TYPE_INFO[t].plural} blurb={TYPE_INFO[t].blurb} onClick={() => changeType(t)} />
              ))}
            </div>
            {editing && <p className="text-[11px] text-slate-400">A group cannot change what it holds. Create a new group instead.</p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="For example: Finance laptops" className={field} autoFocus />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description (optional)</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="What is this group for?" className={field} />
            </label>
            <div className="sm:col-span-2">
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
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How are members chosen?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(MODE_INFO) as MembershipMode[]).map((m) => (
                <Tile key={m} selected={mode === m} title={MODE_INFO[m].label} blurb={MODE_INFO[m].blurb} onClick={() => setMode(m)} />
              ))}
            </div>
            {editing && existing.summary.membershipMode === 'STATIC' && mode === 'DYNAMIC' && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Switching to dynamic removes the members you listed by hand. The rule decides from now on.
              </p>
            )}
          </section>

          {mode === 'DYNAMIC' && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rule</p>
              <RuleBuilder type={type} value={rule} onChange={setRule} />
            </section>
          )}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              Cancel
            </button>
            <button type="button" disabled={!canSave} onClick={() => void save()} className={`${btn} bg-primary-600 text-white hover:bg-primary-700`}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create group'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
