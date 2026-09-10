import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchArticles, createArticleThunk } from '../../features/knowledge-base/knowledgeSlice';
import * as knowledgeApi from '../../api/knowledgeApi';
import type { KnowledgeScript } from '../../types';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';

export default function KnowledgeBasePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { articles, loading, error } = useAppSelector((state) => state.knowledge);
  const { user } = useAppSelector((state) => state.auth);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);

  const [articleSearch, setArticleSearch] = useState('');
  const [scriptSearch, setScriptSearch] = useState('');

  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptsError, setScriptsError] = useState<string | null>(null);

  const [showArticleForm, setShowArticleForm] = useState(false);
  const [showScriptForm, setShowScriptForm] = useState(false);

  useEffect(() => {
    dispatch(fetchArticles());
  }, [dispatch]);

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

  const filteredArticles = articles.filter((a) => {
    if (!articleSearch) return true;
    const q = articleSearch.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      (a.category && a.category.toLowerCase().includes(q)) ||
      (a.tags && a.tags.toLowerCase().includes(q)) ||
      (a.author && a.author.toLowerCase().includes(q))
    );
  });

  const filteredScripts = scripts.filter((s) => {
    if (!scriptSearch) return true;
    const q = scriptSearch.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      (s.language && s.language.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
        <p className="text-sm text-slate-500 mt-1">Browse articles and reference scripts</p>
      </motion.div>

      {/* ── Scripts ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Scripts ({scripts.length})</h2>
          {canManage && (
            <button
              onClick={() => setShowScriptForm(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              + Add Script
            </button>
          )}
        </div>

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

        {scriptsError ? (
          <ErrorMessage message={scriptsError} onRetry={loadScripts} />
        ) : scriptsLoading ? (
          <Loading text="Loading scripts..." />
        ) : filteredScripts.length === 0 ? (
          <EmptyState label="No scripts found" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredScripts.map((script, idx) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="rounded-2xl border border-slate-200 bg-white p-5"
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
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── Articles ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Articles ({articles.length})</h2>
          {canManage && (
            <button
              onClick={() => setShowArticleForm(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              + Add Article
            </button>
          )}
        </div>

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

        {error ? (
          <ErrorMessage message={error} onRetry={() => dispatch(fetchArticles())} />
        ) : loading ? (
          <Loading text="Loading articles..." />
        ) : filteredArticles.length === 0 ? (
          <EmptyState label="No articles found" />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Article</th>
                  <th className="px-5 py-3">Published By</th>
                  <th className="px-5 py-3">Date Published</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map((article, idx) => (
                  <motion.tr
                    key={article.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    onClick={() => navigate(`/knowledge/${article.id}`)}
                    className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{article.title}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {article.category && (
                          <span className="inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                            {article.category}
                          </span>
                        )}
                        {article.tags && article.tags.split(',').slice(0, 3).map((tag) => (
                          <span key={tag.trim()} className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{article.author || 'Unknown'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(article.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={article.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>
                        {article.approvalStatus === 'APPROVED' ? 'Approved' : 'Pending Review'}
                      </Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showArticleForm && (
        <AddArticleModal
          onCancel={() => setShowArticleForm(false)}
          onCreate={async (input) => {
            await dispatch(createArticleThunk(input)).unwrap();
            setShowArticleForm(false);
          }}
        />
      )}

      {showScriptForm && (
        <AddScriptModal
          articles={articles}
          onCancel={() => setShowScriptForm(false)}
          onCreate={async (input) => {
            const created = await knowledgeApi.createScript(input);
            setScripts((prev) => [created, ...prev]);
            setShowScriptForm(false);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
      <svg className="h-12 w-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
      <p className="text-sm text-slate-500">{label}</p>
    </motion.div>
  );
}

function AddArticleModal({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: { title: string; content: string; category: string; tags: string; author: string; status: string }) => Promise<void>;
}) {
  const { user } = useAppSelector((state) => state.auth);
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: '',
    tags: '',
    status: 'PUBLISHED',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      setSaving(true);
      setErr(null);
      await onCreate({ ...form, author: user?.username || 'unknown' });
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
          <h2 className="text-lg font-semibold text-slate-900 mb-4">New Article</h2>
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
            <p className="text-xs text-slate-400">New articles start as Pending Review until approved.</p>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
              Cancel
            </button>
            <button
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

function AddScriptModal({
  articles,
  onCancel,
  onCreate,
}: {
  articles: { id: number; title: string }[];
  onCancel: () => void;
  onCreate: (input: knowledgeApi.CreateScriptInput) => Promise<void>;
}) {
  const { user } = useAppSelector((state) => state.auth);
  const [form, setForm] = useState({
    title: '',
    description: '',
    language: 'powershell',
    content: '',
    articleId: '' as string | number,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
            <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
              Cancel
            </button>
            <button
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
