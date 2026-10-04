import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DEFAULT_CATEGORIES,
  loadCategories,
  resetCategories,
  saveCategories,
  type Category,
} from '../../utils/categoryStore';

const field =
  'rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const btn = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/** Setup → Category & Subcategory: pick a category first, then manage its subcategories. */
export default function CategoriesPage() {
  const [list, setList] = useState<Category[]>(loadCategories);
  const [openName, setOpenName] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [newSub, setNewSub] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const current = list.find((x) => x.name === openName);
  const index = current ? list.indexOf(current) : -1;

  const commit = (next: Category[]) => {
    setList(next);
    setNotice(saveCategories(next) ? null : 'The browser would not save the change (storage is full or blocked).');
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (list.some((x) => x.name.toLowerCase() === name.toLowerCase())) return setNotice(`"${name}" already exists.`);
    commit([...list, { name, subcategories: [] }]);
    setNewCategory('');
  };

  const renameCategory = () => {
    const name = (renaming ?? '').trim();
    if (!current || !name) return setRenaming(null);
    if (list.some((x, i) => i !== index && x.name.toLowerCase() === name.toLowerCase())) return setNotice(`"${name}" already exists.`);
    commit(list.map((x, i) => (i === index ? { ...x, name } : x)));
    setOpenName(name);
    setRenaming(null);
  };

  const deleteCategory = () => {
    if (!current || !window.confirm(`Delete "${current.name}" and its ${current.subcategories.length} subcategories?`)) return;
    commit(list.filter((_, i) => i !== index));
    setOpenName(null);
  };

  const addSub = () => {
    const name = newSub.trim();
    if (!current || !name) return;
    if (current.subcategories.some((s) => s.toLowerCase() === name.toLowerCase())) return setNotice(`"${name}" is already under ${current.name}.`);
    commit(list.map((x, i) => (i === index ? { ...x, subcategories: [...x.subcategories, name] } : x)));
    setNewSub('');
  };

  const removeSub = (name: string) =>
    commit(list.map((x, i) => (i === index ? { ...x, subcategories: x.subcategories.filter((s) => s !== name) } : x)));

  const reset = () => {
    if (!window.confirm('Replace your list with the default categories and subcategories?')) return;
    resetCategories();
    setList(DEFAULT_CATEGORIES);
    setOpenName(null);
    setNotice(null);
  };

  const total = list.reduce((n, x) => n + x.subcategories.length, 0);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">
          Setup
        </Link>
        <span className="text-slate-300">›</span>
        {current ? (
          <>
            <button
              onClick={() => {
                setOpenName(null);
                setRenaming(null);
                setNotice(null);
              }}
              className="text-primary-700 hover:underline"
            >
              Category &amp; Subcategory
            </button>
            <span className="text-slate-300">›</span>
            <span className="font-medium text-slate-800">{current.name}</span>
          </>
        ) : (
          <span className="font-medium text-slate-800">Category &amp; Subcategory</span>
        )}
      </div>
      {notice && <p className="rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">{notice}</p>}

      {!current ? (
        /* Step 1: the categories */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-sm font-semibold text-slate-900">Categories</h1>
            <span className="text-xs text-slate-500">
              {list.length} categories, {total} subcategories. Click a category to see its subcategories.
            </span>
            <button onClick={reset} className={`${btn} ml-auto`}>
              Reset to defaults
            </button>
          </div>

          <div className="flex max-w-md gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="New category"
              aria-label="New category"
              className={`${field} min-w-0 flex-1`}
            />
            <button onClick={addCategory} disabled={!newCategory.trim()} className={btn}>
              Add category
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((x) => (
              <button
                key={x.name}
                onClick={() => {
                  setOpenName(x.name);
                  setNotice(null);
                }}
                className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{x.name}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{x.subcategories.length} subcategories</span>
                </span>
                <span className="ml-2 text-slate-300 transition-colors group-hover:text-primary-500" aria-hidden>
                  ›
                </span>
              </button>
            ))}
            {list.length === 0 && <p className="col-span-full py-10 text-center text-xs text-slate-400">No categories. Add one above.</p>}
          </div>
        </div>
      ) : (
        /* Step 2: the subcategories of the clicked category */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setOpenName(null)} className={btn}>
              ← Categories
            </button>
            {renaming === null ? (
              <>
                <h1 className="text-sm font-semibold text-slate-900">{current.name}</h1>
                <span className="text-xs text-slate-500">{current.subcategories.length} subcategories</span>
                <button onClick={() => setRenaming(current.name)} className="text-xs text-primary-700 hover:underline">
                  Rename
                </button>
                <button onClick={deleteCategory} className="text-xs text-red-600 hover:underline">
                  Delete category
                </button>
              </>
            ) : (
              <>
                <input
                  autoFocus
                  value={renaming}
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameCategory();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  aria-label="Category name"
                  className={`${field} w-56`}
                />
                <button onClick={renameCategory} className={btn}>
                  Save
                </button>
                <button onClick={() => setRenaming(null)} className={btn}>
                  Cancel
                </button>
              </>
            )}
          </div>

          <div className="flex max-w-md gap-2">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
              placeholder={`New subcategory under ${current.name}`}
              aria-label="New subcategory"
              className={`${field} min-w-0 flex-1`}
            />
            <button onClick={addSub} disabled={!newSub.trim()} className={btn}>
              Add subcategory
            </button>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {current.subcategories.map((s) => (
              <li key={s} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800">
                <span className="truncate">{s}</span>
                <button onClick={() => removeSub(s)} aria-label={`Remove ${s}`} className="ml-2 shrink-0 text-slate-400 hover:text-red-600">
                  ✕
                </button>
              </li>
            ))}
            {current.subcategories.length === 0 && <li className="col-span-full py-10 text-center text-xs text-slate-400">No subcategories yet. Add one above.</li>}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        This list feeds the Category and Subcategory fields on the New Incident, incident and New Problem forms. It is saved in this browser only.
      </p>
    </div>
  );
}