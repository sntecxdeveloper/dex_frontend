import { useEffect, useMemo, useState } from 'react';
import { clearGroupFeatures, getFeatureCatalog, getGroupFeatures, setGroupFeatures } from '../../api/groupApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../common/Toast';
import { Button } from '../ui/Button';
import { formatRelativeTime } from '../../utils/formatDate';
import type { FeatureTab, GroupFeatures } from '../../types/group';

interface Props {
  groupId: number;
  groupName: string;
  canEdit: boolean;
  /** Called after a save or reset so the group list counts stay right. */
  onChanged: () => void;
}

/**
 * Which tabs and features of the DEX agent show on the devices of this group. Tick what should be shown; anything unticked is
 * hidden. "Don't manage" leaves the devices on their own setting (or the global one).
 */
export default function FeaturesPanel({ groupId, groupName, canEdit, onChanged }: Props) {
  const [catalog, setCatalog] = useState<FeatureTab[] | null>(null);
  const [saved, setSaved] = useState<GroupFeatures | null>(null);
  const [managed, setManaged] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFeatureCatalog(), getGroupFeatures(groupId)])
      .then(([tabs, f]) => {
        if (cancelled) return;
        setCatalog(tabs);
        setSaved(f);
        setManaged(f.managed);
        setHidden(new Set(f.hidden));
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const dirty = useMemo(() => {
    if (!saved) return false;
    if (managed !== saved.managed) return true;
    if (!managed) return false;
    const a = [...hidden].sort().join(',');
    const b = [...saved.hidden].sort().join(',');
    return a !== b;
  }, [saved, managed, hidden]);

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleOpen = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const setAll = (show: boolean) => {
    if (!catalog) return;
    setHidden(show ? new Set() : new Set(catalog.map((t) => t.key)));
  };

  /** What is sent: hidden tabs, plus hidden features of tabs that stay visible. */
  const toSend = (): string[] => {
    const out: string[] = [];
    (catalog ?? []).forEach((t) => {
      if (hidden.has(t.key)) out.push(t.key);
      else t.features.forEach((f) => hidden.has(f.key) && out.push(f.key));
    });
    return out;
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (managed) await setGroupFeatures(groupId, toSend());
      else await clearGroupFeatures(groupId);
      const fresh = await getGroupFeatures(groupId);
      setSaved(fresh);
      setManaged(fresh.managed);
      setHidden(new Set(fresh.hidden));
      toast(managed ? 'Features saved' : 'This group no longer manages features', 'success');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error && !catalog) return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>;
  if (!catalog || !saved) return <p className="py-6 text-center text-sm text-slate-400">Loading…</p>;

  const hiddenCount = toSend().length;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel p-5">
        <h3 className="text-sm font-semibold text-slate-800">Features shown on the devices of {groupName}</h3>
        <p className="mt-0.5 text-xs text-slate-500">Choose which tabs and features of the DEX agent people on these computers can see.</p>

        <div className="mt-4 space-y-2 text-[13px] text-slate-700">
          <label className="flex items-start gap-2">
            <input type="radio" name="features-mode" checked={!managed} disabled={!canEdit} onChange={() => setManaged(false)} className="mt-0.5 h-4 w-4 accent-sky-600" />
            <span>
              Do not manage
              <span className="block text-[11px] text-slate-500">These devices follow their own setting, or the global one.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="features-mode" checked={managed} disabled={!canEdit} onChange={() => setManaged(true)} className="mt-0.5 h-4 w-4 accent-sky-600" />
            <span>
              Choose what to show
              <span className="block text-[11px] text-slate-500">This group sets what its devices show. A change reaches the agents within a few minutes.</span>
            </span>
          </label>
        </div>
        {saved.managed && saved.updatedBy && (
          <p className="mt-3 text-[11px] text-slate-400">
            Last saved by {saved.updatedBy} {saved.updatedAt ? formatRelativeTime(saved.updatedAt) : ''}
          </p>
        )}
      </section>

      {managed && (
        <section className="rounded-xl border border-line bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <p className="text-[13px] text-slate-700">
              {hiddenCount === 0 ? 'Everything is shown.' : `${hiddenCount} item${hiddenCount === 1 ? '' : 's'} hidden.`}
            </p>
            {canEdit && (
              <div className="flex items-center gap-3 text-xs font-medium">
                <button type="button" onClick={() => setAll(true)} className="text-primary-600 hover:text-primary-700">
                  Show all
                </button>
                <button type="button" onClick={() => setAll(false)} className="text-slate-500 hover:text-slate-800">
                  Hide all
                </button>
              </div>
            )}
          </div>
          <ul className="divide-y divide-line/60">
            {catalog.map((tab) => {
              const tabShown = !hidden.has(tab.key);
              const shownFeatures = tab.features.filter((f) => !hidden.has(f.key)).length;
              const isOpen = open.has(tab.key);
              return (
                <li key={tab.key} className="px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tabShown}
                      disabled={!canEdit}
                      onChange={() => toggle(tab.key)}
                      aria-label={`Show the ${tab.label} tab`}
                      className="h-4 w-4 accent-sky-600"
                    />
                    <span className={`flex-1 text-[13px] font-medium ${tabShown ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{tab.label}</span>
                    {tabShown && tab.features.length > 0 && (
                      <button type="button" onClick={() => toggleOpen(tab.key)} aria-expanded={isOpen} className="text-[11px] text-slate-500 hover:text-slate-800">
                        {shownFeatures} of {tab.features.length} features {isOpen ? '▴' : '▾'}
                      </button>
                    )}
                  </div>
                  {tabShown && isOpen && (
                    <ul className="mt-2 grid gap-x-6 gap-y-1.5 pl-7 sm:grid-cols-2">
                      {tab.features.map((f) => (
                        <li key={f.key}>
                          <label className="flex items-center gap-2 text-[12px] text-slate-700">
                            <input type="checkbox" checked={!hidden.has(f.key)} disabled={!canEdit} onChange={() => toggle(f.key)} className="h-3.5 w-3.5 accent-sky-600" />
                            {f.label}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            <li className="px-5 py-2.5 text-[12px] text-slate-400">The Administrator tab on the device is always available, so it can never be locked out.</li>
          </ul>
        </section>
      )}

      <p className="text-[11px] text-slate-400">
        If a device is in more than one group, anything hidden by any of them is hidden. A setting made for one device wins over its groups, and groups win over the global setting.
      </p>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={!dirty || busy} loading={busy}>
            Save
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">An administrator or operator can change this.</p>
      )}
    </div>
  );
}
