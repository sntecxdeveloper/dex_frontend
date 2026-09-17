import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchArticles } from '../../features/knowledge-base/knowledgeSlice';
import * as knowledgeApi from '../../api/knowledgeApi';
import { ACTION_PERMISSIONS } from '../../utils/constants';

export default function KnowledgeBasePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { articles } = useAppSelector((state) => state.knowledge);
  const { user } = useAppSelector((state) => state.auth);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);

  const [scripts, setScripts] = useState<{ id: number; title: string; language?: string; description?: string; content: string; articleId?: number | null; createdAt: string }[]>([]);

  useEffect(() => {
    dispatch(fetchArticles());
  }, [dispatch]);

  const loadScripts = async () => {
    try {
      const data = await knowledgeApi.getAllScripts();
      setScripts(data);
    } catch {
      // silently ignore — overview is summary-only
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);


  return (
    <div className="space-y-4">
      {/* ── Knowledge Base panel ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 text-left">
          {/* Create buttons */}
          {canManage && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/kb-articles')}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                KB Articles
              </button>
              <button
                type="button"
                onClick={() => navigate('/scripts')}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25m11.25-5.25-5.25 5.25M3.75 6.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5Z" />
                </svg>
                Scripts
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">Knowledge Base</h1>
            <p className="text-sm text-slate-500 mt-0.5">Browse articles and reference scripts</p>
          </div>

          {/* Article + script counts */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              {articles.length} articles
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25m11.25-5.25-5.25 5.25M3.75 6.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5Z" />
              </svg>
              {scripts.length} scripts
            </span>
          </div>
        </div>

        {/* Body — summary only; full listings are at /kb-articles and /scripts */}
        <div className="space-y-4 border-t border-slate-200 px-5">
          {articles.length === 0 && scripts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No articles or scripts yet. Use the buttons above to create some.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 text-sm">
              <a
                href="/kb-articles"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                View all {articles.length} KB article{articles.length !== 1 ? 's' : ''} →
              </a>
              <a
                href="/scripts"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25m11.25-5.25-5.25 5.25M3.75 6.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5Z" />
                </svg>
                View all {scripts.length} script{scripts.length !== 1 ? 's' : ''} →
              </a>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

/* ------------------------------------------------------------------ */


