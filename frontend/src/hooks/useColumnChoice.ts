import { useCallback, useState } from 'react';

export interface ChoosableColumn {
  key: string;
  label: string;
  /** Shown until the person chooses otherwise. */
  initial?: boolean;
  /** Always shown; cannot be removed. */
  fixed?: boolean;
}

function load(storageKey: string, columns: ChoosableColumn[]): Set<string> {
  const defaults = new Set(columns.filter((c) => c.fixed || c.initial).map((c) => c.key));
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return defaults;
    const known = new Set(columns.map((c) => c.key));
    const chosen = new Set(saved.filter((k): k is string => typeof k === 'string' && known.has(k)));
    columns.forEach((c) => c.fixed && chosen.add(c.key));
    return chosen;
  } catch {
    return defaults;
  }
}

/**
 * Which columns of a list are shown, remembered in this browser. A column added later starts hidden unless it is
 * marked `initial` and nothing has been saved yet.
 */
export function useColumnChoice(storageKey: string, columns: ChoosableColumn[]) {
  const [chosen, setChosen] = useState<Set<string>>(() => load(storageKey, columns));

  const save = useCallback(
    (next: Set<string>) => {
      setChosen(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // private window or blocked storage: the choice just lasts until the page is closed
      }
    },
    [storageKey],
  );

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(chosen);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      columns.forEach((c) => c.fixed && next.add(c.key));
      save(next);
    },
    [chosen, columns, save],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // nothing saved to remove
    }
    setChosen(new Set(columns.filter((c) => c.fixed || c.initial).map((c) => c.key)));
  }, [storageKey, columns]);

  return { chosen, isOn: (key: string) => chosen.has(key), toggle, reset };
}
