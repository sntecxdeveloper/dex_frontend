import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import DOMPurify from 'dompurify';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { createArticleThunk } from '../../features/knowledge-base/knowledgeSlice';
import { sendChatMessage } from '../../api/aiApi';
import { addItemToFolder } from '../../stores/kbFolders';
import ArticleEditorToolbar from '../../components/knowledge/ArticleEditorToolbar';
import FolderLocationField from '../../components/knowledge/FolderLocationField';

const ALLOWED_AI_TAGS = ['h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'a'];

export default function NewArticlePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [locationFolderId, setLocationFolderId] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('PUBLISHED');
  const [tags, setTags] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      TableKit.configure({ table: { resizable: true } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Youtube.configure({ width: 560, height: 315 }),
      Placeholder.configure({ placeholder: 'Write Article' }),
    ],
    editorProps: {
      attributes: { class: 'kb-richtext' },
    },
  });

  const handleGenerate = async () => {
    const topic = keywords.trim();
    if (!topic || generating || !editor) return;
    setGenerating(true);
    setAiError(null);
    try {
      const prompt = [
        'You are an IT support knowledge-base writer.',
        `Write a clear solution article about: "${topic}".`,
        'Respond with ONLY raw HTML, no markdown and no code fences, using just these tags: <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>.',
        'The first line must be exactly: TITLE: <a short, specific article title>',
        'Then a line that says exactly: CONTENT:',
        'Then the HTML body: a brief intro paragraph followed by numbered troubleshooting/solution steps.',
      ].join('\n');
      const reply = await sendChatMessage(prompt, null);
      const titleMatch = reply.match(/TITLE:\s*(.+)/i);
      const contentMatch = reply.match(/CONTENT:\s*([\s\S]*)/i);
      const aiTitle = titleMatch?.[1]?.trim();
      const aiContentRaw = contentMatch?.[1]?.trim() || reply;
      const safeHtml = DOMPurify.sanitize(aiContentRaw, { ALLOWED_TAGS: ALLOWED_AI_TAGS });

      if (aiTitle && !title.trim()) setTitle(aiTitle);
      editor.commands.setContent(safeHtml || `<p>${topic}</p>`);
    } catch {
      setAiError('Could not generate the article right now. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async (instruction: string) => {
    if (!editor || refining) return;
    const { from, to, empty } = editor.state.selection;
    const source = empty ? editor.getText() : editor.state.doc.textBetween(from, to, '\n');
    if (!source.trim()) return;

    setRefining(true);
    setAiError(null);
    try {
      const prompt = `${instruction}\n\nText:\n"""\n${source}\n"""\n\nRespond with only the rewritten text, no preamble, no quotes.`;
      const reply = await sendChatMessage(prompt, null);
      const cleaned = reply.trim();
      if (empty) {
        const safeHtml = DOMPurify.sanitize(
          cleaned
            .split(/\n{2,}/)
            .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
            .join(''),
          { ALLOWED_TAGS: ALLOWED_AI_TAGS },
        );
        editor.commands.setContent(safeHtml);
      } else {
        editor.chain().focus().deleteRange({ from, to }).insertContent(cleaned).run();
      }
    } catch {
      setAiError('Refine failed. Please try again.');
    } finally {
      setRefining(false);
    }
  };

  const handleSave = async () => {
    if (!editor || !title.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const content = editor.isEmpty ? '' : editor.getHTML();
      const created = await dispatch(
        createArticleThunk({
          title: title.trim(),
          content,
          category: category.trim() || undefined,
          tags: tags.trim() || undefined,
          author: user?.username || 'unknown',
          status,
        }),
      ).unwrap();

      if (locationFolderId) {
        addItemToFolder('KB_ARTICLES', locationFolderId, String(created.id));
      }
      navigate(`/knowledge/${created.id}`);
    } catch {
      setSaveError('Failed to create article. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <button type="button" onClick={() => navigate('/kb-articles')} className="font-medium text-primary-600 hover:text-primary-700">
            Knowledge Base
          </button>
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-semibold text-slate-900">New Article</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/kb-articles')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Article'}
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
            placeholder="Article title"
            className="w-full px-4 py-3 text-lg font-semibold text-slate-900 rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
          />

          {/* AI generate box */}
          <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-primary-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500/20">
              <svg className="h-4 w-4 flex-shrink-0 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Generate Solution article for</span>
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
                placeholder="Enter a few keywords or key phrases about the article"
                disabled={generating}
                className="flex-1 min-w-0 text-sm text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!keywords.trim() || generating}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-xs text-slate-500">
              <span className="font-medium">Example topics:</span> Forgot password, Best practices for password management
            </p>
            {aiError && <p className="mt-1 px-1 text-xs text-red-500">{aiError}</p>}
          </div>

          {/* Editor */}
          <div className="kb-editor rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <ArticleEditorToolbar editor={editor} onRefine={handleRefine} refining={refining} />
            <div className="px-4 py-4">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-72 shrink-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <FolderLocationField
            type="KB_ARTICLES"
            value={locationFolderId}
            onChange={setLocationFolderId}
            label="Article Location"
            emptyLabel='None ("All Articles")'
            accentClassName="focus:ring-primary-500/20 focus:border-primary-400"
          />

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Networking"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
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

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            >
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
