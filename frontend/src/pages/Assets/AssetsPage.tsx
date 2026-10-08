import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getDevices } from '../../api/deviceApi';
import ErrorMessage from '../../components/common/ErrorMessage';
import AssetFormModal from '../../components/assets/AssetFormModal';
import {
  ASSET_STATUSES,
  assetsToCsv,
  deviceToAsset,
  loadManualAssets,
  nextAssetId,
  parseAssetsCsv,
  saveManualAssets,
  type Asset,
  type AssetStatus,
  type AssetType,
  type NewAsset,
} from '../../utils/assets';

const PAGE_SIZE = 25;

interface TreeNode {
  key: string;
  label: string;
  types?: AssetType[];
  children?: TreeNode[];
}

const ALL_TYPES: AssetType[] = ['Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Monitor', 'Software', 'Others'];

const TREE: TreeNode = {
  key: 'all',
  label: 'All Assets',
  types: ALL_TYPES,
  children: [
    {
      key: 'it',
      label: 'IT',
      types: ALL_TYPES,
      children: [
        {
          key: 'computers',
          label: 'Computers',
          types: ['Laptop', 'Desktop', 'Server'],
          children: [
            { key: 'servers', label: 'Servers', types: ['Server'] },
            { key: 'workstations', label: 'Workstations', types: ['Laptop', 'Desktop'] },
          ],
        },
        { key: 'printers', label: 'Printers', types: ['Printer'] },
        { key: 'network', label: 'Network Devices', types: ['Network Device'] },
        { key: 'monitors', label: 'Monitors', types: ['Monitor'] },
        { key: 'software', label: 'Software', types: ['Software'] },
        { key: 'others', label: 'Others', types: ['Others'] },
      ],
    },
  ],
};

function findNode(node: TreeNode, key: string): TreeNode | null {
  if (node.key === key) return node;
  for (const c of node.children ?? []) {
    const hit = findNode(c, key);
    if (hit) return hit;
  }
  return null;
}

const link =
  'text-[13px] text-slate-700 hover:text-primary-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline';
const bar = 'rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white';

function Menu({ label, items, disabled }: { label: string; items: { label: string; onClick: () => void }[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button disabled={disabled} onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${bar} inline-flex items-center gap-1`}>
        {label}
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="absolute left-0 z-20 mt-1 w-48 rounded border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((i) => (
            <li key={i.label}>
              <button
                onClick={() => {
                  setOpen(false);
                  i.onClick();
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AssetsPage() {
  const [devices, setDevices] = useState<Asset[]>([]);
  const [manual, setManual] = useState<Asset[]>(loadManualAssets);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ asset?: Asset } | null>(null);
  const { view } = useParams();
  const nodeKey = view ?? 'all';
  const [statusF, setStatusF] = useState<AssetStatus | ''>('');
  const [viewOpen, setViewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getDevices()
      .then((d) => setDevices(d.map(deviceToAsset)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load devices'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const assets = useMemo(() => [...manual, ...devices], [manual, devices]);
  const node = findNode(TREE, nodeKey) ?? TREE;
  const unknownView = !!view && !findNode(TREE, view);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter(
      (a) =>
        node.types?.includes(a.type) &&
        (!statusF || a.status === statusF) &&
        (!q || [a.id, a.name, a.user, a.brand, a.model, a.serial ?? '', a.department].some((v) => v.toLowerCase().includes(q))),
    );
  }, [assets, node, statusF, search]);

  useEffect(() => {
    setPage(0);
    setChecked(new Set());
  }, [nodeKey, statusF, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pickedAssets = rows.filter((a) => checked.has(a.id));
  const pickedManual = pickedAssets.filter((a) => a.source === 'manual');
  const allChecked = visible.length > 0 && visible.every((a) => checked.has(a.id));

  const persist = (next: Asset[]) => {
    setManual(next);
    saveManualAssets(next);
  };

  const saveAsset = (n: NewAsset) => {
    const editing = form?.asset;
    if (editing) {
      persist(manual.map((m) => (m.id === editing.id ? { ...m, ...n } : m)));
    } else {
      persist([{ ...n, id: nextAssetId(manual), source: 'manual', lastSeen: new Date().toISOString() }, ...manual]);
    }
    setForm(null);
  };

  const remove = () => {
    if (!confirm(`Delete ${pickedManual.length} asset(s)?`)) return;
    const ids = new Set(pickedManual.map((a) => a.id));
    persist(manual.filter((m) => !ids.has(m.id)));
    setChecked(new Set());
  };

  const setStatus = (status: AssetStatus) => {
    const ids = new Set(pickedManual.map((a) => a.id));
    persist(manual.map((m) => (ids.has(m.id) ? { ...m, status } : m)));
  };

  const assignUsers = () => {
    const name = window.prompt(`Assign ${pickedManual.length} asset(s) to which user?`);
    if (!name?.trim()) return;
    const ids = new Set(pickedManual.map((a) => a.id));
    persist(manual.map((m) => (ids.has(m.id) ? { ...m, user: name.trim() } : m)));
  };

  const exportCsv = () => {
    const blob = new Blob([assetsToCsv(pickedAssets.length ? pickedAssets : rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'assets.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importCsv = async (file: File) => {
    const parsed = parseAssetsCsv(await file.text());
    if (parsed.length === 0) {
      setNotice('No assets found. The CSV needs a header row with a "name" column.');
      return;
    }
    let list = manual;
    for (const n of parsed) list = [{ ...n, id: nextAssetId(list), source: 'manual', lastSeen: new Date().toISOString() }, ...list];
    persist(list);
    setNotice(`Imported ${parsed.length} asset(s).`);
  };

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const editTarget = pickedManual.length === 1 && pickedAssets.length === 1 ? pickedManual[0] : null;
  const manualOnly = pickedManual.length > 0 && pickedManual.length === pickedAssets.length;
  const title = `${statusF ? statusF + ' ' : 'All '}${node.key === 'all' ? 'Assets' : node.label}`;

  if (unknownView) return <Navigate to="/assets" replace />;

  return (
    <div className="flex min-h-[70vh] gap-5">
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-xs text-slate-500">
          All Assets{node.key !== 'all' && ` / ${node.label}`}
        </p>

        <div className="relative flex items-center gap-2">
          <button onClick={() => setViewOpen((v) => !v)} aria-expanded={viewOpen} className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            {title}
            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {viewOpen && (
            <ul className="absolute left-0 top-9 z-20 w-48 rounded border border-slate-200 bg-white py-1 shadow-lg">
              {(['', ...ASSET_STATUSES] as const).map((s) => (
                <li key={s || 'all'}>
                  <button
                    onClick={() => {
                      setStatusF(s);
                      setViewOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${statusF === s ? 'font-semibold text-primary-700' : 'text-slate-700'}`}
                  >
                    {s ? `${s} only` : 'All statuses'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <ErrorMessage message={error} onRetry={load} />}
        {notice && <p className="text-xs text-amber-600">{notice}</p>}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-y border-slate-200 py-2">
          <button onClick={() => setSearchOpen((v) => !v)} aria-label="Search" className="text-slate-500 hover:text-slate-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </button>
          {searchOpen && (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, user, tag…"
              className="w-48 rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary-400 focus:outline-none"
            />
          )}
          <button onClick={() => setForm({})} className={bar}>
            New
          </button>
          <button disabled={!editTarget} onClick={() => editTarget && setForm({ asset: editTarget })} className={bar}>
            Edit
          </button>
          <button disabled={!manualOnly} onClick={remove} className={bar}>
            Delete
          </button>
          <Menu
            label="Actions"
            disabled={pickedAssets.length === 0 && rows.length === 0}
            items={[
              { label: 'Export to CSV', onClick: exportCsv },
              ...ASSET_STATUSES.map((s) => ({
                label: `Mark as ${s}`,
                onClick: () => (manualOnly ? setStatus(s) : setNotice('Select assets you added manually: agent devices are managed on the Devices page.')),
              })),
            ]}
          />
          <button onClick={() => fileRef.current?.click()} className={bar}>
            Import from CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = '';
            }}
          />
          <button disabled={!manualOnly} onClick={assignUsers} className={bar}>
            Assign Users
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
            <span>
              {rows.length === 0 ? 0 : page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page" className={link}>
              ‹
            </button>
            <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page" className={link}>
              ›
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-600">
                <th className="w-8 px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => setChecked(e.target.checked ? new Set(visible.map((a) => a.id)) : new Set())}
                    aria-label="Select all"
                  />
                </th>
                {['Name', 'Product', 'User', 'Service Tag', 'Location', 'Department', 'Status'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.name}`} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {a.deviceId != null ? (
                      <Link to={`/devices/${a.deviceId}`} className="text-primary-700 hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      <button onClick={() => setForm({ asset: a })} className="text-primary-700 hover:underline">
                        {a.name}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {a.brand !== '—' || a.model !== '—' ? `${a.brand === '—' ? '' : a.brand} ${a.model === '—' ? '' : a.model}`.trim() : a.type}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{a.user}</td>
                  <td className="px-3 py-2.5 text-slate-700">{a.serial ?? a.id}</td>
                  <td className="px-3 py-2.5 text-slate-700">{a.location}</td>
                  <td className="px-3 py-2.5 text-slate-700">{a.department}</td>
                  <td className="px-3 py-2.5 text-slate-700">{a.status}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    {loading ? 'Loading…' : 'No assets in this view'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form && <AssetFormModal initial={form.asset} onClose={() => setForm(null)} onSave={saveAsset} />}
    </div>
  );
}
