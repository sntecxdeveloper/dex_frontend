import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchArticles } from '../../features/knowledge-base/knowledgeSlice';
import * as knowledgeApi from '../../api/knowledgeApi';
import type { KnowledgeScript } from '../../types';
import { formatDate } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Badge } from '../../components/ui/Badge';
import KbFolderSidebar from '../../components/knowledge/KbFolderSidebar';
import { subscribeFolders, getFolders } from '../../stores/kbFolders';

type SortKey = 'category' | 'author' | 'createdAt' | 'updatedAt' | 'viewCount' | 'scripts' | 'status' | 'approvalStatus';

function SortableHeader({
  label,
  sortKeyName,
  onSort,
}: {
  label: string;
  sortKeyName: SortKey;
  sortKey: SortKey | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-5 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKeyName)}
        className="inline-flex items-center hover:text-slate-700 transition-colors"
      >
        {label}
      </button>
    </th>
  );
}

export default function KBArticlesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const goBack = () => navigate('/knowledge');
  const { articles, loading, error } = useAppSelector((state) => state.knowledge);
  const { user } = useAppSelector((state) => state.auth);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);

  const [articleSearch, setArticleSearch] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    dispatch(fetchArticles());
  }, [dispatch]);

  useEffect(() => {
    knowledgeApi
      .getAllScripts()
      .then(setScripts)
      .catch(() => setScripts([]));
  }, []);

  const scriptCountByArticle = useMemo(() => {
    const counts = new Map<number, number>();
    for (const script of scripts) {
      if (script.articleId == null) continue;
      counts.set(script.articleId, (counts.get(script.articleId) ?? 0) + 1);
    }
    return counts;
  }, [scripts]);

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

  const sortedArticles = useMemo(() => {
    if (!sortKey) return filteredArticles;
    const getValue = (a: (typeof filteredArticles)[number]): string | number => {
      switch (sortKey) {
        case 'category':
          return a.category?.toLowerCase() ?? '';
        case 'author':
          return a.author?.toLowerCase() ?? '';
        case 'createdAt':
          return new Date(a.createdAt).getTime();
        case 'updatedAt':
          return a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        case 'viewCount':
          return a.viewCount ?? 0;
        case 'scripts':
          return scriptCountByArticle.get(a.id) ?? 0;
        case 'status':
          return (a.status || 'PUBLISHED').toLowerCase();
        case 'approvalStatus':
          return a.approvalStatus === 'APPROVED' ? 1 : 0;
        default:
          return 0;
      }
    };
    return [...filteredArticles].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredArticles, sortKey, sortDir, scriptCountByArticle]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allSelected = sortedArticles.length > 0 && sortedArticles.every((a) => selectedIds.has(a.id));
  const someSelected = !allSelected && sortedArticles.some((a) => selectedIds.has(a.id));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(sortedArticles.map((a) => a.id)) : new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            onClick={() => navigate('/knowledge/new')}
            className="flex items-center gap-2 pl-4 pr-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            New Article
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
        <>
          <label className="flex items-center gap-2 px-1 text-sm text-slate-600 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => toggleSelectAll(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 accent-primary-600 cursor-pointer"
            />
            Select all
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                  <th className="w-10 px-5 py-3" />
                  <th className="px-5 py-3">Article Name</th>
                  <SortableHeader label="Category" sortKeyName="category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Author" sortKeyName="author" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Created On" sortKeyName="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Last Updated" sortKeyName="updatedAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="View Count" sortKeyName="viewCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Associated Scripts" sortKeyName="scripts" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Visibility" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Approval Status" sortKeyName="approvalStatus" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedArticles.map((article) => (
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
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(article.id)}
                        onChange={() => toggleSelect(article.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-primary-600 cursor-pointer"
                        aria-label={`Select ${article.title}`}
                      />
                    </td>
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
                      {(scriptCountByArticle.get(article.id) ?? 0) > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/scripts?articleId=${article.id}`);
                          }}
                          className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                          title="View scripts associated with this article"
                        >
                          {scriptCountByArticle.get(article.id)}
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
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
        </>
      )}
      </div>
      </div>
    </div>
  );
}

