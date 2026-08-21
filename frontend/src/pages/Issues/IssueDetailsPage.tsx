import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchIssueById } from '../../features/issues/issuesSlice';
import { fetchRecommendation } from '../../features/ai/aiSlice';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { formatDateTime } from '../../utils/formatDate';
import { SEVERITY_COLORS, ISSUE_STATUS_COLORS } from '../../utils/constants';

export default function IssueDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selected: issue, loading, error } = useAppSelector((state) => state.issues);
  const { recommendation, loading: aiLoading } = useAppSelector((state) => state.ai);

  useEffect(() => {
    if (id) {
      dispatch(fetchIssueById(Number(id)));
      dispatch(fetchRecommendation(Number(id)));
    }
  }, [dispatch, id]);

  if (loading) return <Loading size="lg" text="Loading issue details..." />;
  if (error) return <ErrorMessage message={error} onRetry={() => id && dispatch(fetchIssueById(Number(id)))} />;
  if (!issue) return <ErrorMessage message="Issue not found" />;

  return (
    <div className="space-y-6">
      {/* Back */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/issues')}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 btn-press transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Issues
      </motion.button>

      {/* Issue header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{issue.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[issue.severity] || ''}`}>
                {issue.severity}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ISSUE_STATUS_COLORS[issue.status] || ''}`}>
                {issue.status}
              </span>
            </div>
            {issue.description && (
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{issue.description}</p>
            )}
          </div>
          <div className="text-right text-xs text-slate-500 space-y-1">
            <p>Device: {issue.deviceHostname || '—'}</p>
            <p>Assigned: {issue.assignedTo || '—'}</p>
            <p>Created: {formatDateTime(issue.createdAt)}</p>
          </div>
        </div>
      </motion.div>

      {/* AI Explanation */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/50 to-white p-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-primary-100 flex items-center justify-center">
            <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-900">AI Analysis</h2>
        </div>

        {aiLoading ? (
          <Loading text="Analyzing..." />
        ) : recommendation ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Explanation</p>
              <p className="text-sm text-slate-700 leading-relaxed">{recommendation.explanation}</p>
            </div>
            {recommendation.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Recommendations</p>
                <ul className="space-y-2">
                  {recommendation.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 mt-0.5">
                        {i + 1}
                      </span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Confidence:</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[120px]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${recommendation.confidence * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="h-full rounded-full bg-primary-500"
                />
              </div>
              <span className="text-xs font-medium text-slate-700">{Math.round(recommendation.confidence * 100)}%</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No AI analysis available for this issue</p>
        )}
      </motion.div>
    </div>
  );
}
