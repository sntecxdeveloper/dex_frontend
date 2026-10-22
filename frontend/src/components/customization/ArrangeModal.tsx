import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { useLayoutArea, type Arrangement } from '../../hooks/useLayoutArea';
import type { LayoutScope } from '../../api/uiLayoutApi';

export interface ArrangeItem {
  key: string;
  label: string;
  /** Always shown (cannot be hidden), e.g. the Dashboard entry. */
  fixed?: boolean;
}

const ROLES = [
  { value: 'ROLE_ADMIN', label: 'Administrators' },
  { value: 'ROLE_OPERATOR', label: 'Operators' },
  { value: 'ROLE_ITSM_TECHNICIAN', label: 'ITSM technicians' },
  { value: 'ROLE_VIEWER', label: 'Viewers' },
];

interface Props {
  /** The layout area this arranges, e.g. "sidebar" or "dashboard". */
  area: string;
  title: string;
  /** All items in the page's own order. */
  items: ArrangeItem[];
  onClose: () => void;
}

/**
 * Show, hide and order the parts of one area of the console: drag a row, or use the arrows. Everyone with a customize level saves
 * their own view; people allowed to do more can also save the default of a group, a role or everyone, and lock it so it cannot be
 * changed further down.
 */
export default function ArrangeModal({ area, title, items, onClose }: Props) {
  const layout = useLayoutArea(area);
  const start = useMemo(() => {
    const base: Arrangement = layout.arrangement ?? { order: [], hidden: [] };
    const byKey = new Map(items.map((i) => [i.key, i]));
    const ordered = [...base.order.filter((k) => byKey.has(k)), ...items.map((i) => i.key).filter((k) => !base.order.includes(k))];
    return { order: ordered, hidden: new Set(base.hidden.filter((k) => byKey.has(k) && !byKey.get(k)?.fixed)) };
  }, [layout.arrangement, items]);

  const [order, setOrder] = useState<string[]>(start.order);
  const [hidden, setHidden] = useState<Set<string>>(start.hidden);
  const [target, setTarget] = useState<string>('me');
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const move = (key: string, to: number) =>
    setOrder((o) => {
      const without = o.filter((k) => k !== key);
      const at = Math.max(0, Math.min(to, without.length));
      return [...without.slice(0, at), key, ...without.slice(at)];
    });
  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Where this can be saved: "me", "group:<id>", "role:<ROLE>", "global".
  const targets: { value: string; label: string }[] = [{ value: 'me', label: 'Just me' }];
  if (layout.level === 'TEAM' || layout.level === 'GLOBAL') layout.groups.forEach((g) => targets.push({ value: `group:${g.id}`, label: `Group: ${g.name}` }));
  if (layout.level === 'GLOBAL') {
    ROLES.forEach((r) => targets.push({ value: `role:${r.value}`, label: `Role: ${r.label}` }));
    targets.push({ value: 'global', label: 'Everyone (default)' });
  }

  const scopeOf = (t: string): [LayoutScope, string] =>
    t === 'global' ? ['GLOBAL', ''] : t.startsWith('group:') ? ['GROUP', t.slice(6)] : t.startsWith('role:') ? ['ROLE', t.slice(5)] : ['USER', ''];

  const save = async () => {
    setBusy(true);
    try {
      const config = { order, hidden: [...hidden] };
      if (target === 'me') await layout.saveMine(config);
      else {
        const [scope, key] = scopeOf(target);
        await layout.saveAt(scope, key, area, config, locked);
      }
      toast(target === 'me' ? 'Your view is saved' : 'Default saved', 'success');
      onClose();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      if (target === 'me') await layout.resetMine();
      else {
        const [scope, key] = scopeOf(target);
        await layout.resetAt(scope, key, area);
      }
      toast('Back to the default', 'success');
      onClose();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const meBlocked = target === 'me' && !layout.canPersonalize;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">Drag to reorder, untick to hide.</p>
          {targets.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="arrange-target" className="text-[12px] font-medium text-slate-600">
                Save for
              </label>
              <select
                id="arrange-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="rounded-lg border border-line bg-white px-2 py-1 text-[12px] text-slate-800"
              >
                {targets.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {target !== 'me' && (
                <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="h-3.5 w-3.5 accent-sky-600" />
                  Lock (people cannot change it)
                </label>
              )}
            </div>
          )}
          {meBlocked && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {layout.lockedByAdmin ? 'An administrator locked this, so it cannot be changed.' : 'You are not allowed to customize this. Ask an administrator.'}
            </p>
          )}
        </div>

        <ul className="flex-1 space-y-1.5 overflow-y-auto px-5 py-3">
          {order.map((key, i) => {
            const item = byKey.get(key);
            if (!item) return null;
            const off = hidden.has(key);
            return (
              <li
                key={key}
                draggable
                onDragStart={() => setDragKey(key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragKey && dragKey !== key) move(dragKey, i);
                  setDragKey(null);
                }}
                className={`flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-[13px] ${off ? 'bg-slate-50 text-slate-400' : 'bg-white text-slate-800'} ${dragKey === key ? 'opacity-40' : ''}`}
              >
                <span className="cursor-grab select-none text-slate-300" aria-hidden="true">⠿</span>
                <input
                  type="checkbox"
                  checked={!off}
                  disabled={item.fixed}
                  onChange={() => toggle(key)}
                  aria-label={`Show ${item.label}`}
                  className="h-4 w-4 accent-sky-600"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <button type="button" disabled={i === 0} onClick={() => move(key, i - 1)} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${item.label} up`}>
                  ▲
                </button>
                <button type="button" disabled={i === order.length - 1} onClick={() => move(key, i + 1)} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${item.label} down`}>
                  ▼
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" size="sm" disabled={busy || meBlocked} onClick={() => void reset()}>
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || meBlocked} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
