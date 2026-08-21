import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchArticleById } from '../../features/knowledge-base/knowledgeSlice';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { formatDateTime } from '../../utils/formatDate';

export default function ArticleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selected: article, loading, error } = useAppSelector((state) => state.knowledge);

  useEffect(() => {
    if (id) dispatch(fetchArticleById(Number(id)));
  }, [dispatch, id]);

  if (loading) return <Loading size="lg" text="Loading article..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!article) return <ErrorMessage message="Article not found" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/knowledge')}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 btn-press transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Knowledge Base
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
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              {article.category && (
                <span className="inline-flex rounded-full bg-primary-100 px-2.5 py-0.5 font-medium text-primary-700">
                  {article.category}
                </span>
              )}
              <span>By {article.author || 'Unknown'}</span>
              <span>{formatDateTime(article.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-sm prose-slate max-w-none">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{article.content}</p>
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span key={tag} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
