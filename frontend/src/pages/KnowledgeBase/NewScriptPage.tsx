import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import * as knowledgeApi from '../../api/knowledgeApi';
import { sendChatMessage } from '../../api/aiApi';
import { addItemToFolder } from '../../stores/kbFolders';
import FolderLocationField from '../../components/knowledge/FolderLocationField';
import ArticleLinkPicker from '../../components/knowledge/ArticleLinkPicker';
import { ScriptLifecycleFields, ScriptSettingsFields } from '../../components/knowledge/ScriptGovernanceFields';
import { governanceFrom, governanceInput } from '../../components/knowledge/scriptGovernance';

const LANGUAGE_OPTIONS = [
  { value: 'powershell', label: 'PowerShell' },
  { value: 'batch', label: 'Batch' },
  { value: 'bash', label: 'Bash' },
  { value: 'python', label: 'Python' },
  { value: 'other', label: 'Other' },
];

const REFINE_ACTIONS = [
  { key: 'improve', label: 'Improve readability', instruction: 'Improve the readability and structure of this script without changing its behavior.' },
  { key: 'comments', label: 'Add comments', instruction: 'Add clear, concise comments explaining what this script does, without changing its behavior.' },
  { key: 'errors', label: 'Add error handling', instruction: 'Add appropriate error handling to this script without changing its core behavior.' },
  { key: 'shorten', label: 'Make more concise', instruction: 'Make this script more concise while keeping the same behavior.' },
] as const;

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[a-z]*\n([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function toPlainText(content: string): string {
  return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function NewScriptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetArticleId = searchParams.get('articleId');
  const { user } = useAppSelector((state) => state.auth);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('powershell');
  const [content, setContent] = useState('');
  const [locationFolderId, setLocationFolderId] = useState('');
  const [articleId, setArticleId] = useState<string>(presetArticleId || '');
  const [articles, setArticles] = useState<{ id: number; title: string }[]>([]);
  const [articleContext, setArticleContext] = useState<{ title: string; content: string } | null>(null);
  const [articleContextLoading, setArticleContextLoading] = useState(false);

  const [keywords, setKeywords] = useState('');
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [governance, setGovernance] = useState(governanceFrom());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    knowledgeApi.getArticles().then(setArticles).catch(() => setArticles([]));
  }, []);

  useEffect(() => {
    if (!articleId) {
      setArticleContext(null);
      return;
    }
    let cancelled = false;
    setArticleContextLoading(true);
    knowledgeApi
      .getArticleById(Number(articleId))
      .then((a) => {
        if (!cancelled) setArticleContext({ title: a.title, content: toPlainText(a.content) });
      })
      .catch(() => {
        if (!cancelled) setArticleContext(null);
      })
      .finally(() => {
        if (!cancelled) setArticleContextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const handleGenerate = async () => {
    const topic = keywords.trim();
    if (!topic || generating) return;
    setGenerating(true);
    setAiError(null);
    try {
      const prompt = [
        'You are an expert IT automation engineer.',
        articleContext
          ? `Base the script on this KB article titled "${articleContext.title}":\n"""\n${articleContext.content.slice(0, 4000)}\n"""\n`
          : null,
        `Write a ${language} script that: ${topic}.`,
        'Respond in exactly this format:',
        'TITLE: <a short, specific script name>',
        'CONTENT:',
        '<the script code only, no markdown code fences, no commentary>',
      ]
        .filter(Boolean)
        .join('\n');
      const reply = await sendChatMessage(prompt, null);
      const titleMatch = reply.match(/TITLE:\s*(.+)/i);
      const contentMatch = reply.match(/CONTENT:\s*([\s\S]*)/i);
      const aiTitle = titleMatch?.[1]?.trim();
      const aiContentRaw = contentMatch?.[1]?.trim() || reply;

      if (aiTitle && !title.trim()) setTitle(aiTitle);
      setContent(stripCodeFences(aiContentRaw));
    } catch {
      setAiError('Could not generate the script right now. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async (instruction: string) => {
    if (!content.trim() || refining) return;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const hasSelection = !!textarea && end > start;
    const source = hasSelection ? content.slice(start, end) : content;

    setRefining(true);
    setAiError(null);
    try {
      const prompt = `${instruction}\n\n${language} script:\n"""\n${source}\n"""\n\nRespond with only the rewritten script, no explanation, no markdown code fences.`;
      const reply = await sendChatMessage(prompt, null);
      const cleaned = stripCodeFences(reply);
      setContent(hasSelection ? content.slice(0, start) + cleaned + content.slice(end) : cleaned);
    } catch {
      setAiError('Refine failed. Please try again.');
    } finally {
      setRefining(false);
    }
  };

  const handleExplain = async () => {
    if (!content.trim() || explaining) return;
    setExplaining(true);
    setExplainError(null);
    try {
      const prompt = [
        `Explain in plain, concise language what this ${language} script does, for an IT support`,
        'agent who may not read code. Use short sentences or a brief bullet list. Do not repeat',
        'or quote the code itself.',
        '',
        'Script:',
        '"""',
        content,
        '"""',
      ].join('\n');
      const reply = await sendChatMessage(prompt, null);
      setExplanation(reply.trim());
    } catch {
      setExplainError('Could not explain the script right now. Please try again.');
    } finally {
      setExplaining(false);
    }
  };

  const handleSave = async (submit: boolean) => {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await knowledgeApi.createScript({
        title: title.trim(),
        description: description.trim() || undefined,
        language,
        content,
        articleId: articleId ? Number(articleId) : null,
        author: user?.username || 'unknown',
        ...governanceInput(governance, true),
      });
      if (submit) await knowledgeApi.submitScript(created.id);

      if (locationFolderId) {
        addItemToFolder('SCRIPTS', locationFolderId, String(created.id));
      }
      navigate('/scripts');
    } catch (err) {
      setSaveError(knowledgeApi.apiError(err, 'Failed to create script. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <button type="button" onClick={() => navigate('/scripts')} className="font-medium text-emerald-600 hover:text-emerald-700">
            Knowledge Base
          </button>
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-semibold text-slate-900">New Script</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/scripts')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!title.trim() || !content.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={!title.trim() || !content.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            title="Saves the script and sends it to another admin/operator for review"
          >
            {saving ? 'Saving...' : 'Save & submit for review'}
          </button>
        </div>
      </div>
      {saveError && <p className="text-xs text-red-500">{saveError}</p>}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Main column */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Script title"
            className="w-full px-4 py-3 text-lg font-semibold text-slate-900 rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this script is for (optional)"
            className="w-full px-4 py-2.5 text-sm text-slate-700 rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />

          {/* AI generate box */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <svg className="h-4 w-4 flex-shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Generate Script for</span>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Enter what the script should do"
                disabled={generating}
                className="flex-1 min-w-0 text-sm text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!keywords.trim() || generating}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {articleContext ? (
              <p className="mt-1.5 px-1 text-xs text-emerald-700">
                <span className="font-medium">Grounded in article:</span> {articleContext.title}
              </p>
            ) : articleContextLoading ? (
              <p className="mt-1.5 px-1 text-xs text-slate-400">Loading linked article...</p>
            ) : (
              <p className="mt-1.5 px-1 text-xs text-slate-500">
                <span className="font-medium">Example topics:</span> Restart print spooler, Clear DNS cache, Free up disk space
              </p>
            )}
            {aiError && <p className="mt-1 px-1 text-xs text-red-500">{aiError}</p>}
          </div>

          {/* Code editor */}
          <div className="rounded-2xl border border-slate-700 bg-black overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-900 px-3 py-1.5">
              <span className="inline-flex rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-200 uppercase">
                {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label ?? language}
              </span>
              <div className="relative">
                <button
                  type="button"
                  disabled={refining || !content.trim()}
                  onClick={() => setRefineOpen((v) => !v)}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium text-emerald-400 hover:bg-slate-700 disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  {refining ? 'Refining...' : 'Refine'}
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {refineOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setRefineOpen(false)} />
                    <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {REFINE_ACTIONS.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => {
                            setRefineOpen(false);
                            handleRefine(action.instruction);
                          }}
                          className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="Write or generate the script here..."
              className="w-full px-4 py-4 text-xs font-mono text-white placeholder-slate-500 bg-black focus:outline-none resize-y"
              spellCheck={false}
            />
          </div>
          <ScriptLifecycleFields value={governance} onChange={setGovernance} />
          <p className="text-xs text-slate-400">
            New scripts start as drafts. Once someone other than you approves it, the approved version is signed and can run on
            devices - the agent checks that signature before running anything.
          </p>
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-72 shrink-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <FolderLocationField
            type="SCRIPTS"
            value={locationFolderId}
            onChange={setLocationFolderId}
            label="Script Location"
            emptyLabel='None ("All Scripts")'
            accentClassName="focus:ring-emerald-500/20 focus:border-emerald-400"
            buttonClassName="bg-emerald-600 hover:bg-emerald-700"
          />

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <ScriptSettingsFields value={governance} onChange={setGovernance} keyEditable />

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Related Article</label>
            <ArticleLinkPicker articles={articles} value={articleId} onChange={setArticleId} />
            <p className="mt-1 text-[11px] text-slate-400">Linking an article grounds AI-generated scripts in its content.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Author</label>
            <input
              type="text"
              value={user?.username || 'Unknown'}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
            />
          </div>

          {/* What this script does — AI explanation of the script written above */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-medium text-slate-500">What this script does</span>
              <button
                type="button"
                onClick={handleExplain}
                disabled={!content.trim() || explaining}
                className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {explaining ? 'Explaining...' : explanation ? 'Re-explain' : 'Explain'}
              </button>
            </div>
            {explainError && <p className="text-[11px] text-red-500 mb-1">{explainError}</p>}
            {explanation ? (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{explanation}</p>
            ) : (
              <p className="text-xs text-slate-400">
                {content.trim()
                  ? 'Click "Explain" to summarize what the script above does.'
                  : 'Write or generate a script above, then click "Explain".'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
