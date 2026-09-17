import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppSelector } from '../../hooks/useAppSelector';
import * as knowledgeApi from '../../api/knowledgeApi';
import type { KnowledgeScript } from '../../types';
import { formatDate } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import KbFolderSidebar from '../../components/knowledge/KbFolderSidebar';
import { subscribeFolders, getFolders } from '../../stores/kbFolders';

export default function ScriptsPage() {
  const navigate = useNavigate();
  const goBack = () => navigate(-1);
  const { user } = useAppSelector((state) => state.auth);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);

  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptsError, setScriptsError] = useState<string | null>(null);
  const [scriptSearch, setScriptSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(true);

  // Re-render on folder changes so counts and filtering stay fresh after drag & drop
  useSyncExternalStore(subscribeFolders, getFolders);
  const selectedFolder = selectedFolderId
    ? (getFolders().find((f) => f.id === selectedFolderId) ?? null)
    : null;

  const loadScripts = async () => {
    try {
      setScriptsLoading(true);
      setScriptsError(null);
      const data = await knowledgeApi.getAllScripts();
      setScripts(data);
    } catch {
      setScriptsError('Failed to load scripts');
    } finally {
      setScriptsLoading(false);
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const filteredScripts = useMemo(() => {
    let list = scripts;
    if (selectedFolder) {
      list = list.filter((s) => selectedFolder.itemIds.includes(String(s.id)));
    } else {
      // "All" view: hide scripts that have been moved into any folder
      const foldersForType = getFolders().filter((f) => f.type === 'SCRIPTS');
      list = list.filter((s) => !foldersForType.some((f) => f.itemIds.includes(String(s.id))));
    }
    if (scriptSearch) {
      const q = scriptSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.language && s.language.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [scripts, scriptSearch, selectedFolder]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {foldersOpen && (
        <div className="w-full lg:w-64 shrink-0">
          <KbFolderSidebar
            type="SCRIPTS"
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            itemIds={scripts.map((s) => String(s.id))}
          />
        </div>
      )}

      {/* Collapse rail — arrow hides/shows the folders panel */}
      <button
        type="button"
        aria-label={foldersOpen ? 'Hide folders' : 'Show folders'}
        aria-expanded={foldersOpen}
        onClick={() => setFoldersOpen((v) => !v)}
        className="hidden lg:flex self-start mt-2 p-1.5 rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-slate-700 hover:border-slate-300 transition-colors"
        title={foldersOpen ? 'Hide folders' : 'Show folders'}
      >
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${foldersOpen ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0 4-4m-4 4h14" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to KB
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scripts</h1>
          <p className="text-sm text-slate-500 mt-1">Reference scripts — browse and manage automation snippets</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25m11.25-5.25-5.25 5.25M3.75 6.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5Z" />
            </svg>
            New Script
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search scripts..."
          value={scriptSearch}
          onChange={(e) => setScriptSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200"
        />
      </div>

      {selectedFolder && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Showing scripts in folder</span>
          <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 font-medium text-primary-700">
            {selectedFolder.name}
          </span>
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Content */}
      {scriptsError ? (
        <ErrorMessage message={scriptsError} onRetry={loadScripts} />
      ) : scriptsLoading ? (
        <Loading text="Loading scripts..." />
      ) : filteredScripts.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <svg className="h-12 w-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25m11.25-5.25-5.25 5.25M3.75 6.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5Z" />
          </svg>
          <p className="text-sm text-slate-500">
            {selectedFolder
              ? `No scripts in "${selectedFolder.name}" yet — drag scripts here from the All list.`
              : 'No scripts found — all scripts are in folders, or none exist yet'}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScripts.map((script) => (
            <div
              key={script.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/kb-item-id', String(script.id));
                e.dataTransfer.setData('text/plain', String(script.id));
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="rounded-2xl border border-slate-200 bg-white p-5 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-900">{script.title}</h3>
                {script.language && (
                  <span className="flex-shrink-0 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 uppercase">
                    {script.language}
                  </span>
                )}
              </div>
              {script.description && (
                <p className="text-xs text-slate-500 mb-3">{script.description}</p>
              )}
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto max-h-40 whitespace-pre-wrap break-words">
                {script.content}
              </pre>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-slate-400">
                  {script.articleId ? (
                    <button
                      onClick={() => navigate(`/knowledge/${script.articleId}`)}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View related article →
                    </button>
                  ) : (
                    'Standalone script'
                  )}
                </span>
                <span className="text-[10px] text-slate-400">{formatDate(script.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Script Modal */}
      {showCreate && (
        <AddScriptModal
          onCancel={() => setShowCreate(false)}
          onCreate={async (input) => {
            const created = await knowledgeApi.createScript(input);
            setScripts((prev) => [created, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
      </div>
      </div>
    </div>
  );
}

/* ── State ── */

function AddScriptModal({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: knowledgeApi.CreateScriptInput) => Promise<void>;
}) {
  const { user } = useAppSelector((state) => state.auth);
  const [articles, setArticles] = useState<{ id: number; title: string }[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    language: 'powershell',
    content: '',
    articleId: '' as string | number,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    knowledgeApi
      .getArticles()
      .then(setArticles)
      .catch(() => setArticles([]));
  }, []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    try {
      setSaving(true);
      setErr(null);
      await onCreate({
        title: form.title,
        description: form.description,
        language: form.language,
        content: form.content,
        articleId: form.articleId ? Number(form.articleId) : null,
        author: user?.username || 'unknown',
      });
    } catch {
      setErr('Failed to create script');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">New Script</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g., Restart print spooler"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="What this script is for"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="powershell">PowerShell</option>
                  <option value="batch">Batch</option>
                  <option value="bash">Bash</option>
                  <option value="python">Python</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Related Article</label>
                <select
                  value={form.articleId}
                  onChange={(e) => setForm({ ...form, articleId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">None (standalone)</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Script Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                placeholder="Restart-Service Spooler"
              />
            </div>
            <p className="text-xs text-slate-400">Reference only — this is never executed by the platform.</p>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.title.trim() || !form.content.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Script'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
