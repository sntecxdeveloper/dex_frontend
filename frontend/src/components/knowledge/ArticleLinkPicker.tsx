import { useState, useSyncExternalStore } from 'react';
import { subscribeFolders, getFolders } from '../../stores/kbFolders';

interface ArticleOption {
  id: number;
  title: string;
}

type View = 'root' | 'all' | { folderId: string };

export default function ArticleLinkPicker({
  articles,
  value,
  onChange,
  accentClassName = 'focus:ring-emerald-500/20 focus:border-emerald-400',
}: {
  articles: ArticleOption[];
  value: string;
  onChange: (articleId: string) => void;
  accentClassName?: string;
}) {
  useSyncExternalStore(subscribeFolders, getFolders);
  const folders = getFolders().filter((f) => f.type === 'KB_ARTICLES');

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('root');

  const selectedTitle = articles.find((a) => String(a.id) === value)?.title;
  const activeFolder = typeof view === 'object' ? folders.find((f) => f.id === view.folderId) : null;
  const visibleArticles =
    view === 'all'
      ? articles
      : activeFolder
        ? articles.filter((a) => activeFolder.itemIds.includes(String(a.id)))
        : [];

  // Count only ids that still correspond to a real article — a folder's itemIds
  // can retain stale ids left behind by deleted/re-linked articles.
  const folderItemCount = (folder: (typeof folders)[number]) =>
    articles.filter((a) => folder.itemIds.includes(String(a.id))).length;

  const close = () => {
    setOpen(false);
    setView('root');
  };

  const pick = (articleId: string) => {
    onChange(articleId);
    close();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg text-sm text-left bg-white focus:outline-none focus:ring-2 ${accentClassName}`}
      >
        <span className={selectedTitle ? 'text-slate-900 truncate' : 'text-slate-400'}>
          {selectedTitle || 'None (standalone)'}
        </span>
        <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-full min-w-[16rem] max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {view === 'root' && (
              <>
                <button
                  type="button"
                  onClick={() => pick('')}
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  None (standalone)
                </button>
                <button
                  type="button"
                  onClick={() => setView('all')}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  All Articles
                  <span className="flex items-center gap-1 text-[10px] font-normal text-slate-400">
                    {articles.length}
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </button>
                <p className="mt-1 border-t border-slate-100 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Folders
                </p>
                {folders.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">No folders yet.</p>
                ) : (
                  folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setView({ folderId: f.id })}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        {folderItemCount(f)}
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                    </button>
                  ))
                )}
              </>
            )}

            {view !== 'root' && (
              <>
                <button
                  type="button"
                  onClick={() => setView('root')}
                  className="flex w-full items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  {view === 'all' ? 'All Articles' : activeFolder?.name}
                </button>
                {visibleArticles.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400">
                    {view === 'all' ? 'No articles found.' : 'No articles in this folder yet.'}
                  </p>
                ) : (
                  visibleArticles.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => pick(String(a.id))}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                        String(a.id) === value ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{a.title}</span>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
