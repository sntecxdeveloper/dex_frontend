import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useProgressiveList } from '../../hooks/useProgressiveList';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppSelector } from '../../hooks/useAppSelector';
import * as knowledgeApi from '../../api/knowledgeApi';
import type { KnowledgeScript } from '../../types';
import { formatDate } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import KbFolderSidebar from '../../components/knowledge/KbFolderSidebar';
import ArticleLinkPicker from '../../components/knowledge/ArticleLinkPicker';
import { subscribeFolders, getFolders, createFolder, addItemToFolder, removeItemFromFolder } from '../../stores/kbFolders';
import ScriptDetailsModal from '../../components/knowledge/ScriptDetailsModal';
import { AdminBadge, RiskBadge, ScriptKeyChip, ScriptStatusBadge } from '../../components/knowledge/scriptMeta';
import { ScriptLifecycleFields, ScriptSettingsFields } from '../../components/knowledge/ScriptGovernanceFields';
import { governanceFrom, governanceInput } from '../../components/knowledge/scriptGovernance';

export default function ScriptsPage() {
  const navigate = useNavigate();
  const goBack = () => navigate('/knowledge');
  const { user } = useAppSelector((state) => state.auth);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);
  const canApprove = !!user?.role && ACTION_PERMISSIONS.APPROVE_KB_ARTICLE.includes(user.role);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'DRAFTS'>('ALL');

  const [searchParams, setSearchParams] = useSearchParams();
  const filterArticleId = searchParams.get('articleId');
  const newForArticleId = searchParams.get('newForArticle');
  const [filterArticleTitle, setFilterArticleTitle] = useState<string | null>(null);
  const autoOpenedForRef = useRef<string | null>(null);
  const autoCreateOpenedRef = useRef<string | null>(null);

  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptsError, setScriptsError] = useState<string | null>(null);
  const [scriptSearch, setScriptSearch] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [viewScript, setViewScript] = useState<KnowledgeScript | null>(null);
  const [editingScript, setEditingScript] = useState<KnowledgeScript | null>(null);
  const [articles, setArticles] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    knowledgeApi
      .getArticles()
      .then(setArticles)
      .catch(() => setArticles([]));
  }, []);

  const articleTitleById = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of articles) map.set(a.id, a.title);
    return map;
  }, [articles]);

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

  useEffect(() => {
    if (!filterArticleId) {
      setFilterArticleTitle(null);
      return;
    }
    knowledgeApi
      .getArticleById(Number(filterArticleId))
      .then((a) => setFilterArticleTitle(a.title))
      .catch(() => setFilterArticleTitle(null));
  }, [filterArticleId]);

  const clearArticleFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('articleId');
      return next;
    });
  };

  // Coming from a KB Article's "Associated Scripts" count: if it links to exactly
  // one script, open that script directly instead of leaving the user on the list.
  useEffect(() => {
    if (!filterArticleId || scriptsLoading) return;
    if (autoOpenedForRef.current === filterArticleId) return;
    const matches = scripts.filter((s) => String(s.articleId) === filterArticleId);
    if (matches.length === 1) {
      setViewScript(matches[0]);
    }
    autoOpenedForRef.current = filterArticleId;
  }, [filterArticleId, scripts, scriptsLoading]);

  // Coming from an Article's "+ New Script" shortcut: send to the create page pre-filled with that article.
  useEffect(() => {
    if (!newForArticleId) return;
    if (autoCreateOpenedRef.current === newForArticleId) return;
    autoCreateOpenedRef.current = newForArticleId;
    navigate(`/scripts/new?articleId=${newForArticleId}`, { replace: true });
  }, [newForArticleId, navigate]);

  // One row per script key (its newest version) in the All view; the review /
  // approved / drafts views list the matching versions themselves.
  const latestPerKey = useMemo(() => {
    const byKey = new Map<string, KnowledgeScript>();
    for (const s of scripts) {
      const cur = byKey.get(s.scriptKey);
      if (!cur || s.version > cur.version) byKey.set(s.scriptKey, s);
    }
    return [...byKey.values()];
  }, [scripts]);

  const pendingCount = scripts.filter((s) => s.status === 'PENDING_REVIEW').length;
  const deferredSearch = useDeferredValue(scriptSearch);

  const filteredScripts = useMemo(() => {
    let list =
      statusFilter === 'ALL'
        ? latestPerKey
        : statusFilter === 'DRAFTS'
          ? scripts.filter((s) => s.status === 'DRAFT' || s.status === 'REJECTED')
          : scripts.filter((s) => s.status === statusFilter);
    if (filterArticleId) {
      list = list.filter((s) => String(s.articleId) === filterArticleId);
    } else if (selectedFolder) {
      list = list.filter((s) => selectedFolder.itemIds.includes(String(s.id)));
    } else {
      // "All" view: hide scripts that have been moved into any folder
      const inFolders = new Set(getFolders().filter((f) => f.type === 'SCRIPTS').flatMap((f) => f.itemIds));
      list = list.filter((s) => !inFolders.has(String(s.id)));
    }
    if (deferredSearch) {
      const q = deferredSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.language && s.language.toLowerCase().includes(q)) ||
          s.scriptKey.toLowerCase().includes(q),
      );
    }
    return list;
  }, [scripts, latestPerKey, statusFilter, deferredSearch, selectedFolder, filterArticleId]);
  const rows = useProgressiveList(filteredScripts, 50, `${deferredSearch}|${statusFilter}|${selectedFolderId}|${filterArticleId}`);

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
          <p className="text-sm text-slate-500 mt-1">Reviewed, signed fixes the DEX agent can run on devices</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => navigate('/scripts/new')}
            className="flex items-center gap-2 pl-4 pr-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            New Script
            <span className="h-4 w-px bg-white/30" />
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
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

      {/* Review status */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['ALL', 'All scripts'],
            ['PENDING_REVIEW', `Needs review${pendingCount ? ` (${pendingCount})` : ''}`],
            ['APPROVED', 'Approved'],
            ['DRAFTS', 'Drafts & rejected'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatusFilter(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === id
                ? 'bg-primary-600 text-white'
                : id === 'PENDING_REVIEW' && pendingCount
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100'
                  : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filterArticleId ? (        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Showing scripts associated with article</span>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            {filterArticleTitle ?? `#${filterArticleId}`}
          </span>
          <button
            type="button"
            onClick={clearArticleFilter}
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            Clear
          </button>
        </div>
      ) : selectedFolder && (
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
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                <th className="px-5 py-3">Script</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Fixes</th>
                <th className="px-5 py-3">Author</th>
                <th className="px-5 py-3">Last Updated</th>
                <th className="px-5 py-3">Articles</th>
              </tr>
            </thead>
            <tbody>
              {rows.visible.map((script) => (
                <tr
                  key={script.id}
                  onClick={() => setViewScript(script)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/kb-item-id', String(script.id));
                    e.dataTransfer.setData('text/plain', String(script.id));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="border-b border-slate-100 last:border-0 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900">{script.title}</div>
                    <ScriptKeyChip script={script} />
                  </td>
                  <td className="px-5 py-3.5">
                    <ScriptStatusBadge status={script.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      <RiskBadge risk={script.riskLevel} />
                      {script.requiresAdmin && <AdminBadge />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 max-w-[10rem] truncate" title={script.issueMatch ?? ''}>
                    {script.issueMatch?.split(',').map((m) => m.trim()).filter(Boolean).join(', ') || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{script.author || script.createdBy || 'Unknown'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{formatDate(script.updatedAt ?? script.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    {script.articleId && articleTitleById.has(script.articleId) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/knowledge/${script.articleId}`);
                        }}
                        className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                        title={`Open associated article: ${articleTitleById.get(script.articleId)}`}
                      >
                        1
                      </button>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.hasMore && (
                <tr ref={rows.sentinelRef}>
                  <td colSpan={7} className="px-5 py-3 text-center text-xs text-slate-400">
                    Showing {rows.visible.length} of {rows.total} scripts…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View Script Modal */}
      {viewScript && (
        <ScriptDetailsModal
          key={viewScript.id}
          script={viewScript}
          username={user?.username}
          canManage={canManage}
          canApprove={canApprove}
          onClose={() => setViewScript(null)}
          onEdit={(s) => {
            setEditingScript(s);
            setViewScript(null);
          }}
          onChanged={() => loadScripts()}
          onOpenArticle={(id) => navigate(`/knowledge/${id}`)}
        />
      )}

      {/* Edit Script Modal */}
      {editingScript && (
        <ScriptFormModal
          initial={editingScript}
          onCancel={() => setEditingScript(null)}
          onSubmit={async (input, folderName) => {
            const updated = await knowledgeApi.updateScript(editingScript.id, input);
            // Editing an approved script creates a new draft version - reload to show both.
            await loadScripts();
            const trimmedFolder = folderName.trim();
            if (trimmedFolder) {
              const folder = createFolder(trimmedFolder, 'SCRIPTS');
              addItemToFolder('SCRIPTS', folder.id, String(updated.id));
            } else {
              // Folder field cleared — send the script back to "All"
              removeItemFromFolder('SCRIPTS', String(updated.id));
            }
            setEditingScript(null);
          }}
        />
      )}
      </div>
      </div>
    </div>
  );
}

/* ── State ── */

function ScriptFormModal({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: KnowledgeScript;
  onCancel: () => void;
  onSubmit: (input: knowledgeApi.CreateScriptInput, folderName: string) => Promise<void>;
}) {
  const isEdit = !!initial;
  const { user } = useAppSelector((state) => state.auth);
  const [articles, setArticles] = useState<{ id: number; title: string }[]>([]);
  const folderNames = getFolders()
    .filter((f) => f.type === 'SCRIPTS')
    .map((f) => f.name);
  const currentFolderName = initial
    ? (getFolders().find((f) => f.type === 'SCRIPTS' && f.itemIds.includes(String(initial.id)))?.name ?? '')
    : '';
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    language: initial?.language ?? 'powershell',
    content: initial?.content ?? '',
    articleId: (initial?.articleId ?? '') as string | number,
    folder: currentFolderName,
  });
  const [governance, setGovernance] = useState(governanceFrom(initial));
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
      await onSubmit(
        {
          title: form.title,
          description: form.description,
          language: form.language,
          content: form.content,
          articleId: form.articleId ? Number(form.articleId) : null,
          author: initial?.author || user?.username || 'unknown',
          ...governanceInput(governance, !isEdit),
        },
        form.folder,
      );
    } catch (e) {
      setErr(knowledgeApi.apiError(e, isEdit ? 'Failed to save changes' : 'Failed to create script'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">{isEdit ? 'Edit Script' : 'New Script'}</h2>
          {isEdit && (initial?.status === 'APPROVED' || initial?.status === 'RETIRED') ? (
            <p className="mb-4 text-xs text-amber-700">
              This version is {initial.status.toLowerCase()}. Saving creates version {initial.version + 1} as a draft; version{' '}
              {initial.version} keeps running until the new one is approved.
            </p>
          ) : (
            <p className="mb-4 text-xs text-slate-500">Saving puts the script back in draft - submit it for review again when ready.</p>
          )}
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
                <ArticleLinkPicker
                  articles={articles}
                  value={String(form.articleId)}
                  onChange={(articleId) => setForm({ ...form, articleId })}
                  accentClassName="focus:ring-primary-500/20 focus:border-primary-400"
                />
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Folder</label>
              <input
                type="text"
                value={form.folder}
                onChange={(e) => setForm({ ...form, folder: e.target.value })}
                list="script-folder-options"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g., Print scripts (leave empty for All)"
              />
              <datalist id="script-folder-options">
                {folderNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <p className="text-xs text-slate-400 mt-1">
                Type a folder name and the script will be filed there (created if it doesn't exist).
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <ScriptSettingsFields value={governance} onChange={setGovernance} keyEditable={!isEdit} />
            </div>
            <ScriptLifecycleFields value={governance} onChange={setGovernance} />
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
              {saving ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save Changes' : 'Create Script'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
