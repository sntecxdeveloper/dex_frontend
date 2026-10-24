import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ArrangeItem } from '../components/customization/ArrangeModal';

/** What the open page offers to customize: its parts (in the page's own order) and which access page it belongs to. */
export interface PageCustomizeConfig {
  /** The layout area, e.g. "page.devices". */
  area: string;
  title: string;
  /** The role-system page ("devices"): whether the person may customize it follows "<page>.customize". */
  page: string;
  /** First part of the address, for the section's own color ("devices", "issues"...). */
  sectionKey?: string;
  items: ArrangeItem[];
}

interface Registry {
  config: PageCustomizeConfig | null;
  register: (config: PageCustomizeConfig) => void;
  clear: (area: string) => void;
}

/** What the Customize panel is showing right now (not saved yet): the page draws itself with it, so a change is seen at once. */
export interface LayoutDraft {
  area: string;
  order: string[];
  hidden: string[];
}

const PageCustomizeContext = createContext<Registry | null>(null);
const DraftContext = createContext<{ draft: LayoutDraft | null; setDraft: (d: LayoutDraft | null) => void } | null>(null);

/**
 * The open page tells the top bar what can be customized on it; the one Customize icon in the top bar then works for every page,
 * so no page needs its own button.
 */
export function PageCustomizeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageCustomizeConfig | null>(null);
  const [draft, setDraft] = useState<LayoutDraft | null>(null);
  const draftValue = useMemo(() => ({ draft, setDraft }), [draft]);
  const register = useCallback((c: PageCustomizeConfig) => setConfig(c), []);
  const clear = useCallback((area: string) => setConfig((c) => (c?.area === area ? null : c)), []);
  const value = useMemo(() => ({ config, register, clear }), [config, register, clear]);
  return (
    <PageCustomizeContext.Provider value={value}>
      <DraftContext.Provider value={draftValue}>{children}</DraftContext.Provider>
    </PageCustomizeContext.Provider>
  );
}

const NONE: Registry = { config: null, register: () => undefined, clear: () => undefined };

export function usePageCustomizeRegistry(): Registry {
  return useContext(PageCustomizeContext) ?? NONE;
}

const NO_DRAFT = { draft: null, setDraft: () => undefined };

/** The unsaved arrangement the Customize panel is previewing (null when none is open). */
export function useLayoutDraft(): { draft: LayoutDraft | null; setDraft: (d: LayoutDraft | null) => void } {
  return useContext(DraftContext) ?? NO_DRAFT;
}
