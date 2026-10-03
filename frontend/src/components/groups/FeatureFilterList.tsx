import { useState } from 'react';
import type { ColumnFilter } from '../common/ColumnMenu';
import type { FeatureTab } from '../../types/group';

/** Special choices next to the feature keys. */
export const FEATURES_DEFAULT = 'DEFAULT';
export const FEATURES_ALL_SHOWN = 'ALLSHOWN';

/**
 * Does a group match what was ticked in the Features menu? Ticking a tab finds groups that hide that tab or any of its
 * features; ticking one feature finds groups that hide it or its whole tab. Several ticks mean "any of these".
 */
export function matchesFeatureChoice(
  group: { featuresManaged: boolean; hiddenFeatureKeys: string[] },
  chosen: Set<string>,
): boolean {
  const hidden = new Set(group.hiddenFeatureKeys);
  for (const key of chosen) {
    if (key === FEATURES_DEFAULT) {
      if (!group.featuresManaged) return true;
    } else if (key === FEATURES_ALL_SHOWN) {
      if (group.featuresManaged && hidden.size === 0) return true;
    } else if (hidden.has(key)) {
      return true;
    } else if (!key.includes('.')) {
      if (group.hiddenFeatureKeys.some((h) => h.startsWith(key + '.'))) return true;
    } else if (hidden.has(key.slice(0, key.indexOf('.')))) {
      return true;
    }
  }
  return false;
}

interface Props {
  catalog: FeatureTab[];
  filter: ColumnFilter;
  onFilter: (next: ColumnFilter) => void;
}

/** The body of the Features column menu: tick what to look for, and open a tab to see its features. */
export default function FeatureFilterList({ catalog, filter, onFilter }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const chosen = filter.values ?? new Set<string>();

  const toggle = (key: string) => {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onFilter({ ...filter, values: next.size === 0 ? null : next });
  };

  const toggleOpen = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const row = 'flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-100';

  return (
    <div className="max-h-64 overflow-y-auto px-1 pb-1">
      <p className="px-2 pb-1 pt-0.5 text-[10px] text-slate-400">Show groups that…</p>
      <label className={row}>
        <input type="checkbox" checked={chosen.has(FEATURES_DEFAULT)} onChange={() => toggle(FEATURES_DEFAULT)} className="h-3.5 w-3.5 accent-sky-600" />
        <span className="text-slate-800">Use the default (not managed)</span>
      </label>
      <label className={row}>
        <input type="checkbox" checked={chosen.has(FEATURES_ALL_SHOWN)} onChange={() => toggle(FEATURES_ALL_SHOWN)} className="h-3.5 w-3.5 accent-sky-600" />
        <span className="text-slate-800">Manage but show everything</span>
      </label>
      <p className="px-2 pb-1 pt-2 text-[10px] text-slate-400">Hide…</p>
      <ul>
        {catalog.map((tab) => {
          const isOpen = open.has(tab.key);
          return (
            <li key={tab.key}>
              <div className={row}>
                <input
                  type="checkbox"
                  checked={chosen.has(tab.key)}
                  onChange={() => toggle(tab.key)}
                  aria-label={`Groups that hide ${tab.label}`}
                  className="h-3.5 w-3.5 accent-sky-600"
                />
                <span className="flex-1 text-slate-800">{tab.label}</span>
                {tab.features.length > 0 && (
                  <button type="button" onClick={() => toggleOpen(tab.key)} aria-expanded={isOpen} aria-label={`${tab.label} features`} className="px-1 text-[10px] text-slate-500 hover:text-slate-900">
                    {tab.features.length} {isOpen ? '▴' : '▾'}
                  </button>
                )}
              </div>
              {isOpen && (
                <ul className="ml-5 border-l border-slate-200 pl-1">
                  {tab.features.map((f) => (
                    <li key={f.key}>
                      <label className={row}>
                        <input type="checkbox" checked={chosen.has(f.key)} onChange={() => toggle(f.key)} className="h-3.5 w-3.5 accent-sky-600" />
                        <span className="text-slate-700">{f.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
