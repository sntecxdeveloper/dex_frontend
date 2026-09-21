import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchArticleById, approveArticleThunk, revokeApprovalThunk, updateArticleThunk } from '../../features/knowledge-base/knowledgeSlice';
import * as knowledgeApi from '../../api/knowledgeApi';
import type { CreateArticleInput } from '../../api/knowledgeApi';
import type { KnowledgeScript, KnowledgeScreenshot } from '../../types';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import { getFolders, createFolder, addItemToFolder, removeItemFromFolder } from '../../stores/kbFolders';

export default function ArticleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  // Pop the history entry so browser-back continues further back, not forward to this article again.
  // Fall back to the KB Articles list when there is no in-app history (direct link / refresh).
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/kb-articles', { replace: true });
  };
  const { selected: article, loading, error } = useAppSelector((state) => state.knowledge);
  const { user } = useAppSelector((state) => state.auth);

  const canApprove = !!user?.role && ACTION_PERMISSIONS.APPROVE_KB_ARTICLE.includes(user.role);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);

  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [screenshots, setScreenshots] = useState<KnowledgeScreenshot[]>([]);
  const [approving, setApproving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<KnowledgeScreenshot | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddScript, setShowAddScript] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) dispatch(fetchArticleById(articleId));
  }, [dispatch, id, articleId]);

  useEffect(() => {
    if (!id) return;
    knowledgeApi.getScriptsByArticle(articleId).then(setScripts).catch(() => {});
    knowledgeApi.getScreenshotsByArticle(articleId).then(setScreenshots).catch(() => {});
  }, [id, articleId]);

  const handleApprove = async () => {
    try {
      setApproving(true);
      await dispatch(approveArticleThunk(articleId)).unwrap();
    } finally {
      setApproving(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setApproving(true);
      await dispatch(revokeApprovalThunk(articleId)).unwrap();
    } finally {
      setApproving(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const dataUrl = await fileToDataUrl(file);
      const created = await knowledgeApi.addScreenshot(articleId, file.name, dataUrl);
      setScreenshots((prev) => [...prev, created]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteScreenshot = async (screenshotId: number) => {
    if (!confirm('Delete this screenshot?')) return;
    await knowledgeApi.deleteScreenshot(screenshotId);
    setScreenshots((prev) => prev.filter((s) => s.id !== screenshotId));
  };

  if (loading) return <Loading size="lg" text="Loading article..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!article) return <ErrorMessage message="Article not found" />;

  const isApproved = article.approvalStatus === 'APPROVED';

  return (
    <div className="space-y-6 max-w-3xl">
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={goBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 btn-press transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>          Back to KB Articles
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{article.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
              {article.category && (
                <span className="inline-flex rounded-full bg-primary-100 px-2.5 py-0.5 font-medium text-primary-700">
                  {article.category}
                </span>
              )}
              <span>By {article.author || 'Unknown'}</span>
              <span>{formatDateTime(article.createdAt)}</span>
              <Badge tone={isApproved ? 'success' : 'warning'}>
                {isApproved ? 'Approved' : 'Pending Review'}
              </Badge>
              {isApproved && article.approvedBy && (
                <span className="text-slate-400">
                  by {article.approvedBy}{article.approvedAt ? ` on ${formatDateTime(article.approvedAt)}` : ''}
                </span>
              )}
            </div>
          </div>

          {(canManage || canApprove) && (
            <div className="flex-shrink-0 flex items-center gap-2">
              {canManage && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100"
                >
                  Edit
                </button>
              )}
              {canApprove && (isApproved ? (
                <button
                  onClick={handleRevoke}
                  disabled={approving}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                >
                  Revoke Approval
                </button>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approving ? 'Approving...' : 'Approve Article'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {isLikelyHtml(article.content) ? (
          <div className="kb-richtext" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }} />
        ) : (
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{article.content}</p>
        )}

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {article.tags.split(',').map((tag) => (
                <span key={tag.trim()} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Screenshots */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Screenshots</h2>
          {canManage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : '+ Add Screenshot'}
              </button>
            </>
          )}
        </div>
        {screenshots.length === 0 ? (
          <p className="text-xs text-slate-400">No screenshots attached.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {screenshots.map((s) => (
              <div key={s.id} className="group relative rounded-lg overflow-hidden border border-slate-200">
                <img
                  src={s.imageData}
                  alt={s.caption || 'Screenshot'}
                  className="w-full h-28 object-cover cursor-pointer"
                  onClick={() => setPreview(s)}
                />
                {s.caption && (
                  <p className="text-[10px] text-slate-500 px-1.5 py-1 truncate">{s.caption}</p>
                )}
                {canManage && (
                  <button
                    onClick={() => handleDeleteScreenshot(s.id)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Related scripts */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Related Scripts</h2>
          {canManage && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddScript(true)}
                className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100"
              >
                + Add Script
              </button>
              <button
                onClick={() => navigate(`/scripts?newForArticle=${articleId}`)}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
              >
                + New Script
              </button>
            </div>
          )}
        </div>
        {scripts.length === 0 ? (
          <p className="text-xs text-slate-400">No scripts linked to this article.</p>
        ) : (
          <div className="space-y-3">
            {scripts.map((script) => (
              <div key={script.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-slate-900">{script.title}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {script.language && (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase">
                        {script.language}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700"
                      title="Associated articles"
                    >
                      Articles: {script.articleId === articleId ? 1 : 0}
                    </span>
                  </div>
                </div>
                {script.description && <p className="text-xs text-slate-500 mb-2">{script.description}</p>}
                <pre className="bg-slate-900 text-white rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words">
                  {script.content}
                </pre>
                {canManage && (
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={async () => {
                        if (!confirm(`Unlink "${script.title}" from this article?`)) return;
                        await knowledgeApi.updateScript(script.id, {
                          title: script.title,
                          description: script.description,
                          language: script.language,
                          content: script.content,
                          author: script.author,
                          articleId: null,
                        });
                        setScripts((prev) => prev.filter((s) => s.id !== script.id));
                      }}
                      className="text-[10px] font-medium text-slate-400 hover:text-red-500"
                    >
                      Unlink
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {preview && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
        >
          <img src={preview.imageData} alt={preview.caption || 'Screenshot'} className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      {showAddScript && (
        <AddScriptPickerModal
          articleId={articleId}
          linkedScriptIds={scripts.map((s) => s.id)}
          onCancel={() => setShowAddScript(false)}
          onLinked={(script) => {
            setScripts((prev) => [...prev, script]);
            setShowAddScript(false);
          }}
        />
      )}

      {showEdit && (
        <EditArticleModal
          article={article}
          onCancel={() => setShowEdit(false)}
          onSave={async (input, folderName) => {
            await dispatch(updateArticleThunk({ id: articleId, input })).unwrap();
            const trimmedFolder = folderName.trim();
            if (trimmedFolder) {
              const folder = createFolder(trimmedFolder, 'KB_ARTICLES');
              addItemToFolder('KB_ARTICLES', folder.id, String(articleId));
            } else {
              removeItemFromFolder('KB_ARTICLES', String(articleId));
            }
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}

function EditArticleModal({
  article,
  onCancel,
  onSave,
}: {
  article: { id: number; title: string; content: string; category?: string; tags?: string; status?: string };
  onCancel: () => void;
  onSave: (input: CreateArticleInput, folderName: string) => Promise<void>;
}) {
  const currentFolderName =
    getFolders().find((f) => f.type === 'KB_ARTICLES' && f.itemIds.includes(String(article.id)))?.name ?? '';
  const folderNames = getFolders()
    .filter((f) => f.type === 'KB_ARTICLES')
    .map((f) => f.name);
  const [form, setForm] = useState({
    title: article.title,
    content: article.content,
    category: article.category || '',
    tags: article.tags || '',
    status: article.status || 'PUBLISHED',
    folder: currentFolderName,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      setSaving(true);
      setErr(null);
      const { folder: folderName, ...articleInput } = form;
      await onSave(articleInput, folderName);
    } catch {
      setErr('Failed to save changes');
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
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Edit KB Article</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
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
                  <option value="ARCHIVED">Archived</option>
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
                list="kb-edit-folder-options"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Leave empty for All"
              />
              <datalist id="kb-edit-folder-options">
                {folderNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
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
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AddScriptPickerModal({
  articleId,
  linkedScriptIds,
  onCancel,
  onLinked,
}: {
  articleId: number;
  linkedScriptIds: number[];
  onCancel: () => void;
  onLinked: (script: KnowledgeScript) => void;
}) {
  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    knowledgeApi
      .getAllScripts()
      .then(setScripts)
      .catch(() => setErr('Failed to load scripts'))
      .finally(() => setLoading(false));
  }, []);

  const candidates = scripts
    .filter((s) => !linkedScriptIds.includes(s.id))
    .filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase()));

  const handleLink = async (script: KnowledgeScript) => {
    try {
      setLinkingId(script.id);
      setErr(null);
      const updated = await knowledgeApi.updateScript(script.id, {
        title: script.title,
        description: script.description,
        language: script.language,
        content: script.content,
        author: script.author,
        articleId,
      });
      onLinked(updated);
    } catch {
      setErr('Failed to link script');
    } finally {
      setLinkingId(null);
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
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Add Existing Script</h2>
          <p className="text-xs text-slate-500 mb-4">
            Pick a script to link to this article. Scripts already linked to another article will be moved here.
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scripts..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
          />
          {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
          {loading ? (
            <p className="text-xs text-slate-400 py-4 text-center">Loading scripts...</p>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No scripts to link.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {candidates.map((script) => (
                <div
                  key={script.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{script.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {script.articleId ? 'Linked to another article' : 'Standalone'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLink(script)}
                    disabled={linkingId === script.id}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {linkingId === script.id ? 'Linking...' : 'Link'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function isLikelyHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
