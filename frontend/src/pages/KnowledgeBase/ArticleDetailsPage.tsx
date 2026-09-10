import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchArticleById, approveArticleThunk, revokeApprovalThunk } from '../../features/knowledge-base/knowledgeSlice';
import * as knowledgeApi from '../../api/knowledgeApi';
import type { KnowledgeScript, KnowledgeScreenshot } from '../../types';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../../utils/formatDate';
import { ACTION_PERMISSIONS } from '../../utils/constants';

export default function ArticleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selected: article, loading, error } = useAppSelector((state) => state.knowledge);
  const { user } = useAppSelector((state) => state.auth);

  const canApprove = !!user?.role && ACTION_PERMISSIONS.APPROVE_KB_ARTICLE.includes(user.role);
  const canManage = !!user?.role && ACTION_PERMISSIONS.MANAGE_KB_CONTENT.includes(user.role);

  const [scripts, setScripts] = useState<KnowledgeScript[]>([]);
  const [screenshots, setScreenshots] = useState<KnowledgeScreenshot[]>([]);
  const [approving, setApproving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<KnowledgeScreenshot | null>(null);
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

          {canApprove && (
            <div className="flex-shrink-0">
              {isApproved ? (
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
              )}
            </div>
          )}
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
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Related Scripts</h2>
        {scripts.length === 0 ? (
          <p className="text-xs text-slate-400">No scripts linked to this article.</p>
        ) : (
          <div className="space-y-3">
            {scripts.map((script) => (
              <div key={script.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-slate-900">{script.title}</h3>
                  {script.language && (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase">
                      {script.language}
                    </span>
                  )}
                </div>
                {script.description && <p className="text-xs text-slate-500 mb-2">{script.description}</p>}
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words">
                  {script.content}
                </pre>
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
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
