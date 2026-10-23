import { useCallback, useEffect, useState } from 'react';
import { applySuggestion, applyTemplate, getSuggestions, getTemplates, undoSuggestion, type AppliedSuggestion, type LayoutSuggestion, type TemplatePack } from '../../api/insightsApi';
import { getOrganizations } from '../../api/organizationApi';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatRelativeTime } from '../../utils/formatDate';
import { useUiLayouts } from '../../context/UiLayoutContext';
import { NAV_ITEMS } from '../../utils/constants';
import type { Organization } from '../../types/organization';

const MENU = NAV_ITEMS.map((i) => i.icon);

/** Suggested layouts from what people really open, accepted with one click and undone with another. */
export function SuggestionsTab() {
  const { refresh } = useUiLayouts();
  const [data, setData] = useState<{ suggestions: LayoutSuggestion[]; applied: AppliedSuggestion[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getSuggestions(MENU));
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, what: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await what();
      await load();
      await refresh();
      toast(done, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel p-5">
        <h3 className="text-sm font-semibold text-slate-800">Suggested from the last 30 days of use</h3>
        <p className="text-[12px] text-slate-500">DEX counts which menu entries people open and which agent tabs computers open. Nothing else is recorded.</p>
        {data && data.suggestions.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No suggestions yet. They appear once at least two people of a role (or two computers of a group) have used DEX for a while.</p>}
        <ul className="mt-3 space-y-2">
          {data?.suggestions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800">{s.title}</p>
                <p className="text-[12px] text-slate-500">
                  {s.detail} {s.kind === 'AGENT_TABS' ? '(Agent)' : '(Console)'}
                </p>
              </div>
              <Button size="sm" disabled={busy === s.id} onClick={() => void run(s.id, () => applySuggestion(s.id, MENU), 'Applied. You can undo it below.')}>
                Accept
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {data && data.applied.length > 0 && (
        <section className="rounded-xl border border-line bg-panel p-5">
          <h3 className="text-sm font-semibold text-slate-800">Accepted suggestions</h3>
          <ul className="mt-2 divide-y divide-line text-[13px]">
            {data.applied.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <span className={a.undone ? 'text-slate-400 line-through' : 'text-slate-700'}>
                  {a.summary}
                  <span className="ml-2 text-[11px] text-slate-400">
                    by {a.appliedBy ?? 'unknown'} {a.appliedAt ? formatRelativeTime(a.appliedAt) : ''}
                  </span>
                </span>
                {!a.undone && (
                  <button type="button" disabled={busy === `u${a.id}`} onClick={() => void run(`u${a.id}`, () => undoSuggestion(a.id), 'Undone')} className="text-[12px] text-primary-600 hover:text-primary-700">
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Ready-made packs per industry, applied to one company in one step. */
export function PacksTab() {
  const { refresh } = useUiLayouts();
  const [packs, setPacks] = useState<TemplatePack[] | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [org, setOrg] = useState<string>('');
  const [withConsole, setWithConsole] = useState(false);
  const [withFields, setWithFields] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getTemplates().then(setPacks).catch((err) => toast(getErrorMessage(err), 'error'));
    getOrganizations().then((o) => { setOrgs(o); if (o.length > 0) setOrg(String(o[0].id)); }).catch(() => undefined);
  }, []);

  const apply = async (p: TemplatePack) => {
    setBusy(p.id);
    try {
      const r = await applyTemplate(p.id, org ? Number(org) : null, withConsole, withFields);
      await refresh();
      const parts = [
        r.agentView ? 'agent view set' : null,
        r.console ? 'console colors and menu set' : null,
        r.fieldsAdded.length ? `${r.fieldsAdded.length} ticket field(s) added` : null,
        r.fieldsKept.length ? `${r.fieldsKept.length} existing field(s) kept` : null,
        r.triggersAdded ? `${r.triggersAdded} trigger(s) added` : null,
      ].filter(Boolean);
      toast(`${p.name}: ${parts.join(', ') || 'nothing to change'}`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <label className="flex items-center gap-2">
          Company
          <select value={org} onChange={(e) => setOrg(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5">
            <option value="">(do not set an agent view)</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={withFields} onChange={(e) => setWithFields(e.target.checked)} className="h-3.5 w-3.5 accent-sky-600" />
          Add its ticket fields and triggers
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={withConsole} onChange={(e) => setWithConsole(e.target.checked)} className="h-3.5 w-3.5 accent-sky-600" />
          Also set the console colors and menu for everyone
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {packs?.map((p) => (
          <div key={p.id} className="flex flex-col rounded-xl border border-line p-4">
            <h4 className="text-sm font-semibold text-slate-800">{p.name}</h4>
            <p className="mt-1 flex-1 text-[12px] text-slate-600">{p.description}</p>
            <p className="mt-2 text-[11px] text-slate-400">
              Hides {p.hiddenInAgent} agent item(s) · {p.fields} field(s) · {p.triggers} trigger(s)
            </p>
            <Button size="sm" className="mt-3" disabled={busy === p.id} onClick={() => void apply(p)}>
              {busy === p.id ? 'Applying…' : 'Apply'}
            </Button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">A pack never overwrites ticket fields that already exist. The company's agent view and the console defaults it sets can be changed or removed afterwards like any other.</p>
    </section>
  );
}
