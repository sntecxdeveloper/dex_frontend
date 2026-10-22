import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCustomizationTargets } from '../../api/customizationApi';
import CustomizationEditor from '../../components/customization/CustomizationEditor';
import { Skeleton } from '../../components/ui/Skeleton';
import { getErrorMessage } from '../../utils/errorHandler';
import type { CustomizationTarget } from '../../types/customization';

/**
 * Agent customization: choose a group of devices (or, for administrators, an organization) and decide what its computers see in the
 * DEX agent and in which order. For administrators only.
 */
export default function AgentCustomizationPage() {
  const [params, setParams] = useSearchParams();
  const [targets, setTargets] = useState<CustomizationTarget[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTargets(await getCustomizationTargets());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const wantedGroup = params.get('group');
  const wantedOrg = params.get('organization');
  const selected =
    targets?.find((t) => (wantedGroup ? t.type === 'group' && String(t.id) === wantedGroup : wantedOrg ? t.type === 'organization' && String(t.id) === wantedOrg : false)) ?? null;

  const choose = (value: string) => {
    if (!value) setParams({});
    else {
      const [type, id] = value.split(':');
      setParams(type === 'group' ? { group: id } : { organization: id });
    }
  };

  const groups = targets?.filter((t) => t.type === 'group') ?? [];
  const organizations = targets?.filter((t) => t.type === 'organization') ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900">Agent customization</h1>
        <p className="mt-0.5 text-sm text-slate-500">Choose what people see in the DEX agent on a group's computers, and in which order.</p>
      </header>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {!targets && !error && <Skeleton className="h-24 w-full" />}

      {targets && targets.length === 0 && (
        <p className="rounded-xl border border-line bg-panel px-5 py-8 text-center text-sm text-slate-500">
          There are no groups of devices yet. Create a device group first.
        </p>
      )}

      {targets && targets.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-5 py-3">
          <label htmlFor="cust-target" className="text-[13px] font-medium text-slate-700">
            Customize the agent for
          </label>
          <select
            id="cust-target"
            value={selected ? `${selected.type}:${selected.id}` : ''}
            onChange={(e) => choose(e.target.value)}
            className="min-w-[260px] rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] text-slate-800"
          >
            <option value="">Choose a group…</option>
            {groups.length > 0 && (
              <optgroup label="Groups of devices">
                {groups.map((g) => (
                  <option key={`group:${g.id}`} value={`group:${g.id}`}>
                    {g.name} ({g.devices} computer{g.devices === 1 ? '' : 's'}){g.managed ? ' • customized' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {organizations.length > 0 && (
              <optgroup label="Organizations">
                {organizations.map((o) => (
                  <option key={`organization:${o.id}`} value={`organization:${o.id}`}>
                    {o.name} ({o.devices} computer{o.devices === 1 ? '' : 's'}){o.managed ? ' • customized' : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {selected && <CustomizationEditor key={`${selected.type}:${selected.id}`} target={selected} onChanged={() => void load()} />}
    </div>
  );
}
