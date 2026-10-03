import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChoosableColumn } from '../../hooks/useColumnChoice';

interface Props {
  columns: ChoosableColumn[];
  isOn: (key: string) => boolean;
  onToggle: (key: string) => void;
  onReset: () => void;
}

/** A small gear for a list heading: tick the columns you want to see, and the list changes at once. */
export default function ColumnChooser({ columns, isOn, onToggle, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 232;
    setPos({ left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)), top: r.bottom + 4 });
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

  const shown = columns.filter((c) => isOn(c.key)).length;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose columns"
        aria-expanded={open}
        title="Choose columns"
        className="flex items-center gap-1 rounded px-1.5 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 9h15M4.5 15h15M5.25 4.5h13.5A.75.75 0 0 1 19.5 5.25v13.5a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V5.25a.75.75 0 0 1 .75-.75Z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Columns"
            style={{ left: pos.left, top: pos.top, width: 232 }}
            className="fixed z-[60] rounded-lg border border-slate-300 bg-white py-1 text-xs shadow-xl"
          >
            <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Columns ({shown})</p>
              <button type="button" onClick={onReset} className="text-[11px] font-medium text-primary-700 hover:underline">
                Reset
              </button>
            </div>
            <ul className="max-h-72 overflow-y-auto px-1 pb-1">
              {columns.map((c) => (
                <li key={c.key}>
                  <label className={`flex items-center gap-2 rounded px-2 py-1 ${c.fixed ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-slate-100'}`}>
                    <input
                      type="checkbox"
                      checked={isOn(c.key)}
                      disabled={c.fixed}
                      onChange={() => onToggle(c.key)}
                      className="h-3.5 w-3.5 accent-sky-600"
                    />
                    <span className="text-slate-800">{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
