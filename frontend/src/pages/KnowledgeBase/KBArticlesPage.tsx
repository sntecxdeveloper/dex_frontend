import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchArticles, createArticleThunk } from '../../features/knowledge-base/knowledgeSlice';
import { formatDate } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Badge } from '../../components/ui/Badge';
import KbFolderSidebar from '../../components/knowledge/KbFolderSidebar';
import { subscribeFolders, getFolders, createFolder, addItemToFolder } from '../../stores/kbFolders';

export default function KBArticlesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const goBack = () => navigate(-1);
  const { articles, loading, error } = useAppSelector((state) => state.knowledge);
  const { user } = useAppSelector((state) => state.auth);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);

  const [articleSearch, setArticleSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(true);

  useEffect(() => {
    dispatch(fetchArticles());
  }, [dispatch]);

  // Re-render on folder changes so counts and filtering stay fresh after drag & drop
  useSyncExternalStore(subscribeFolders, getFolders);
  const selectedFolder = selectedFolderId
    ? (getFolders().find((f) => f.id === selectedFolderId) ?? null)
    : null;

  const filteredArticles = useMemo(() => {
    let list = articles;
    if (selectedFolder) {
      list = list.filter((a) => selectedFolder.itemIds.includes(String(a.id)));
    } else {
      // "All" view: hide articles that have been moved into any folder
      const foldersForType = getFolders().filter((f) => f.type === 'KB_ARTICLES');
      list = list.filter((a) => !foldersForType.some((f) => f.itemIds.includes(String(a.id))));
    }
    if (articleSearch) {
      const q = articleSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          (a.category && a.category.toLowerCase().includes(q)) ||
          (a.tags && a.tags.toLowerCase().includes(q)) ||
          (a.author && a.author.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [articles, articleSearch, selectedFolder]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {foldersOpen && (
        <div className="w-full lg:w-64 shrink-0">
          <KbFolderSidebar
            type="KB_ARTICLES"
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            itemIds={articles.map((a) => String(a.id))}
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
          <h1 className="text-2xl font-bold text-slate-900">KB Articles</h1>
          <p className="text-sm text-slate-500 mt-1">Knowledge base articles — create, browse, and manage</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New KB Article
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
          placeholder="Search articles..."
          value={articleSearch}
          onChange={(e) => setArticleSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200"
        />
      </div>

      {selectedFolder && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Showing articles in folder</span>
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
      {error ? (
        <ErrorMessage message={error} onRetry={() => dispatch(fetchArticles())} />
      ) : loading ? (
        <Loading text="Loading articles..." />
      ) : filteredArticles.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <svg className="h-12 w-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-sm text-slate-500">
            {selectedFolder
              ? `No articles in "${selectedFolder.name}" yet — drag articles here from the All list.`
              : 'No KB articles found — all articles are in folders, or none exist yet'}
          </p>
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                <th className="px-5 py-3">Article Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Author</th>
                <th className="px-5 py-3">Created On</th>
                <th className="px-5 py-3">Last Updated</th>
                <th className="px-5 py-3">View Count</th>
                <th className="px-5 py-3">Visibility</th>
                <th className="px-5 py-3">Approval Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map((article) => (
                <tr
                  key={article.id}
                  onClick={() => navigate(`/knowledge/${article.id}`)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/kb-item-id', String(article.id));
                    e.dataTransfer.setData('text/plain', String(article.id));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="border-b border-slate-100 last:border-0 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900">{article.title}</div>
                    {article.tags && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {article.tags.split(',').slice(0, 3).map((tag) => (
                          <span key={tag.trim()} className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {article.category ? (
                      <span className="inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                        {article.category}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{article.author || 'Unknown'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{formatDate(article.createdAt)}</td>
                  <td className="px-5 py-3.5 text-slate-500">{article.updatedAt ? formatDate(article.updatedAt) : '—'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{article.viewCount ?? 0}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={article.status === 'DRAFT' ? 'neutral' : article.status === 'ARCHIVED' ? 'danger' : 'info'}>
                      {article.status || 'PUBLISHED'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={article.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>
                      {article.approvalStatus === 'APPROVED' ? 'Approved' : 'Pending Review'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

        {/* Create Article Modal */}
        {showCreate && (
          <AddArticleModal
            onCancel={() => setShowCreate(false)}
            onCreate={async (input, folderName) => {
              const created = await dispatch(createArticleThunk(input)).unwrap();
              const trimmedFolder = folderName.trim();
              if (trimmedFolder) {
                // Create folder if needed, then file the new article into it
                const folder = createFolder(trimmedFolder, 'KB_ARTICLES');
                addItemToFolder('KB_ARTICLES', folder.id, String(created.id));
                setSelectedFolderId(folder.id);
              }
              setShowCreate(false);
            }}
          />
        )}
      </div>
      </div>
    </div>
  );
}

function AddArticleModal({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: { title: string; content: string; category: string; tags: string; author: string; status: string }, folderName: string) => Promise<void>;
}) {
  const { user } = useAppSelector((state) => state.auth);
  const folderNames = getFolders()
    .filter((f) => f.type === 'KB_ARTICLES')
    .map((f) => f.name);
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: '',
    tags: '',
    folder: '',
    status: 'PUBLISHED',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      setSaving(true);
      setErr(null);
      const { folder: folderName, ...articleInput } = form;
      await onCreate({ ...articleInput, author: user?.username || 'unknown' }, folderName);
      setForm({ title: '', content: '', category: '', tags: '', folder: '', status: 'PUBLISHED' });
    } catch {
      setErr('Failed to create article');
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
          <h2 className="text-lg font-semibold text-slate-900 mb-4">New KB Article</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                placeholder="e.g., How to fix stuck print spooler"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                placeholder="Article content..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g., Networking"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Comma-separated tags"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Folder</label>
              <input
                type="text"
                value={form.folder}
                onChange={(e) => setForm({ ...form, folder: e.target.value })}
                list="kb-folder-options"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g., Networking guides (leave empty for All)"
              />
              <datalist id="kb-folder-options">
                {folderNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <p className="text-xs text-slate-400 mt-1">
                Type a folder name and the article will be filed there (created if it doesn't exist).
              </p>
            </div>
            <p className="text-xs text-slate-400">New articles start as Pending Review until approved.</p>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.title.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Article'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
