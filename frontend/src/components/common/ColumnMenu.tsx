import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** One value a column can be filtered by, with how many rows have it. */
export interface ColumnValue {
  value: string;
  label?: string;
  count?: number;
}

export type ColumnKind = 'text' | 'number' | 'date';

export interface ColumnFilter {
  /** Rows whose cell text contains this. */
  text: string;
  /** Only rows with one of these values; null means every value. */
  values: Set<string> | null;
}

export const NO_FILTER: ColumnFilter = { text: '', values: null };

export const isFiltered = (f?: ColumnFilter) => !!f && (f.text.trim() !== '' || f.values !== null);

const SORT_LABELS: Record<ColumnKind, [string, string]> = {
  text: ['A → Z', 'Z → A'],
  number: ['Low → High', 'High → Low'],
  date: ['Oldest first', 'Newest first'],
};

interface Props {
  label: string;
  kind: ColumnKind;
  values: ColumnValue[];
  filter: ColumnFilter;
  onFilter: (next: ColumnFilter) => void;
  /** Direction when this column is the one the list is sorted by; null otherwise. */
  sorted: 'asc' | 'desc' | null;
  onSort: (dir: 'asc' | 'desc') => void;
  /** Anything extra to show in the menu (the Features column puts its nested list here). */
  children?: React.ReactNode;
}

/**
 * The little dropdown on a column heading: sort the list, search inside the column, or tick the values to show. Everything
 * applies the moment it is chosen.
 */
export default function ColumnMenu({ label, kind, values, filter, onFilter, sorted, onSort, children }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 272;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 4 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || button.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? values.filter((v) => (v.label ?? v.value).toLowerCase().includes(q)) : values;
  }, [values, query]);

  const active = isFiltered(filter);
  const allValues = values.map((v) => v.value);
  const isOn = (v: string) => filter.values === null || filter.values.has(v);

  const toggleValue = (v: string) => {
    const current = filter.values ?? new Set(allValues);
    const next = new Set(current);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onFilter({ ...filter, values: next.size === allValues.length ? null : next });
  };

  const setShown = (on: boolean) => {
    const ids = new Set(shown.map((v) => v.value));
    const current = filter.values ?? new Set(allValues);
    const next = new Set(current);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onFilter({ ...filter, values: next.size === allValues.length ? null : next });
  };

  const [asc, desc] = SORT_LABELS[kind];
  const sortButton = (dir: 'asc' | 'desc', text: string) => (
    <button
      type="button"
      onClick={() => onSort(dir)}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-100 ${sorted === dir ? 'font-semibold text-primary-700' : 'text-slate-700'}`}
    >
      {text}
      {sorted === dir && <span aria-hidden="true">✓</span>}
    </button>
  );

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${label} options`}
        aria-expanded={open}
        title={`${label} options`}
        className={`ml-1 rounded px-1 text-[10px] leading-none hover:bg-slate-200 ${active || sorted ? 'text-primary-700' : 'text-slate-400'}`}
      >
        {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '▾'}
        {active && <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-primary-600 align-middle" aria-label="filtered" />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={`${label} sort and filter`}
            style={{ left: pos.left, top: pos.top, width: 272 }}
            className="fixed z-[60] rounded-lg border border-slate-300 bg-white py-1 text-xs font-normal shadow-xl"
          >
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sort</p>
            {sortButton('asc', asc)}
            {sortButton('desc', desc)}

            <div className="my-1 border-t border-slate-200" />
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Filter</p>
            <div className="px-3 pb-1.5">
              <input
                value={filter.text}
                onChange={(e) => onFilter({ ...filter, text: e.target.value })}
                placeholder={`Text contains…`}
                aria-label={`${label} text contains`}
                className="h-7 w-full rounded border border-slate-300 px-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {children ?? (
              <>
                <div className="px-3 pb-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search values…"
                    aria-label={`Search ${label} values`}
                    className="h-7 w-full rounded border border-slate-300 px-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center justify-between px-3 pb-1 text-[11px]">
                  <button type="button" onClick={() => setShown(true)} className="text-primary-700 hover:underline">
                    Select all
                  </button>
                  <button type="button" onClick={() => setShown(false)} className="text-slate-500 hover:underline">
                    Clear
                  </button>
                </div>
                <ul className="max-h-52 overflow-y-auto px-1">
                  {shown.map((v) => (
                    <li key={v.value}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-100">
                        <input type="checkbox" checked={isOn(v.value)} onChange={() => toggleValue(v.value)} className="h-3.5 w-3.5 accent-sky-600" />
                        <span className="min-w-0 flex-1 truncate text-slate-800">{v.label ?? (v.value || '(empty)')}</span>
                        {v.count !== undefined && <span className="shrink-0 text-[10px] text-slate-400">{v.count}</span>}
                      </label>
                    </li>
                  ))}
                  {shown.length === 0 && <li className="px-2 py-2 text-slate-400">No values match.</li>}
                </ul>
              </>
            )}

            {active && (
              <div className="mt-1 border-t border-slate-200 px-3 pt-1.5 pb-1">
                <button type="button" onClick={() => onFilter(NO_FILTER)} className="text-[11px] font-medium text-primary-700 hover:underline">
                  Clear filter on {label}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
