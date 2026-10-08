import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyView,
  defaultView,
  groupRows,
  newRuleId,
  repairView,
  type Field,
  type QuickFilter,
  type RowGroup,
  type SortLevel,
  type View,
} from '../utils/listView';

export interface SavedView {
  id: string;
  name: string;
  view: View;
}

interface Options<T> {
  /** Where this list keeps what it remembers in this browser. */
  storageKey: string;
  fields: Field<T>[];
  rows: T[];
  quick?: QuickFilter[];
  defaultSort?: SortLevel;
}

function read<V>(key: string): V | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private window or blocked storage: it just lasts until the page is closed
  }
}

/**
 * Everything an advanced list needs besides its table: the view (search, conditions, sort, columns, grouping), the rows that
 * result, saved views, and the ways to change them. The columns, sort and grouping are remembered in this browser; the
 * conditions and search are not, unless the person saves a view.
 */
export function useListView<T>({ storageKey, fields, rows, quick = [], defaultSort }: Options<T>) {
  const fresh = useCallback(() => defaultView(fields, defaultSort), [fields, defaultSort]);

  const [view, setViewState] = useState<View>(() => {
    const remembered = read<Partial<View>>(`${storageKey}.state`);
    const base = defaultView(fields, defaultSort);
    return repairView({ ...base, ...(remembered ?? {}), search: '', rules: [], quick: null, match: 'ALL' }, fields);
  });
  const [saved, setSaved] = useState<SavedView[]>(() => (read<SavedView[]>(`${storageKey}.views`) ?? []).map((s) => ({ ...s, view: repairView(s.view, fields) })));

  useEffect(() => {
    write(`${storageKey}.state`, { columns: view.columns, sorts: view.sorts, groupBy: view.groupBy });
  }, [storageKey, view.columns, view.sorts, view.groupBy]);

  const setView = useCallback((next: View | ((v: View) => View)) => setViewState((v) => (typeof next === 'function' ? next(v) : next)), []);

  const processed = useMemo(() => applyView(rows, fields, view, quick), [rows, fields, view, quick]);
  const groups: RowGroup<T>[] = useMemo(() => groupRows(processed, fields, view.groupBy), [processed, fields, view.groupBy]);

  const shown = useMemo(() => view.columns.map((k) => fields.find((f) => f.key === k)).filter((f): f is Field<T> => !!f), [view.columns, fields]);

  const saveCurrent = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setSaved((prev) => {
        const next = [...prev.filter((s) => s.name.toLowerCase() !== trimmed.toLowerCase()), { id: newRuleId(), name: trimmed, view }];
        write(`${storageKey}.views`, next);
        return next;
      });
    },
    [storageKey, view],
  );

  const deleteSaved = useCallback(
    (id: string) =>
      setSaved((prev) => {
        const next = prev.filter((s) => s.id !== id);
        write(`${storageKey}.views`, next);
        return next;
      }),
    [storageKey],
  );

  const applySaved = useCallback((id: string) => {
    const found = saved.find((s) => s.id === id);
    if (found) setViewState(repairView(found.view, fields));
  }, [saved, fields]);

  const reset = useCallback(() => setViewState(fresh()), [fresh]);

  return { view, setView, processed, groups, shown, saved, saveCurrent, deleteSaved, applySaved, reset, fresh };
}
