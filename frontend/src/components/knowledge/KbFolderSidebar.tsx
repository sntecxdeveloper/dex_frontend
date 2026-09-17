import { useState, useSyncExternalStore } from 'react';
import {
  subscribeFolders,
  getFolders,
  createFolder,
  deleteFolder,
  addItemToFolder,
  removeItemFromFolder,
  type KbFolder,
  type KbFolderType,
} from '../../stores/kbFolders';

interface KbFolderSidebarProps {
  type: KbFolderType;
  /** Currently selected folder id, or null for "All". */
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  /** Item ids currently visible in the main list (for per-folder counts). */
  itemIds: string[];
}

export default function KbFolderSidebar({
  type,
  selectedFolderId,
  onSelectFolder,
  itemIds,
}: KbFolderSidebarProps) {
  const allFolders = useSyncExternalStore(subscribeFolders, getFolders);
  const folders = allFolders.filter((f) => f.type === type);
  const [name, setName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const typeLabel = type === 'KB_ARTICLES' ? 'KB Articles' : 'Scripts';
  const typeLabelLower = typeLabel.toLowerCase();

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createFolder(trimmed, type);
    setName('');
  };

  const inFolderCount = (folder: KbFolder) =>
    folder.itemIds.filter((id) => itemIds.includes(id)).length;

  // Items not placed in any folder — these are what the "All" view shows
  const unfiledCount = itemIds.filter(
    (id) => !folders.some((f) => f.itemIds.includes(id)),
  ).length;

  const handleDrop = (e: React.DragEvent, folder: KbFolder | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    // Read the custom payload first, fall back to text/plain for browser quirks
    const itemId = e.dataTransfer.getData('text/kb-item-id') || e.dataTransfer.getData('text/plain');
    if (!itemId) return;
    if (folder === null) {
      removeItemFromFolder(type, itemId);
    } else {
      addItemToFolder(type, folder.id, itemId);
      // Open the folder immediately so the dropped item is visible
      onSelectFolder(folder.id);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Folders</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">New folder</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder={type === 'KB_ARTICLES' ? 'e.g., Networking guides' : 'e.g., Print scripts'}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
          />
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!name.trim()}
          className="w-full px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create
        </button>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          {typeLabel} folders
        </h3>

        {/* "All" pseudo-folder — drop here to remove from any folder */}
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId('__all__');
          }}
          onDragLeave={() => setDragOverId((prev) => (prev === '__all__' ? null : prev))}
          onDrop={(e) => handleDrop(e, null)}
          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
            selectedFolderId === null
              ? 'border-primary-300 bg-primary-50 text-primary-700'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          } ${dragOverId === '__all__' ? 'ring-2 ring-primary-400 border-primary-400 bg-primary-50/70' : ''}`}
        >
          <span className="font-medium">All {typeLabelLower}</span>
          <span className="text-[10px] font-medium text-slate-400">{unfiledCount}</span>
        </button>

        {folders.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            No folders yet. Create one and drag {typeLabelLower} onto it.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {folders.map((folder) => {
              const selected = selectedFolderId === folder.id;
              const isDragOver = dragOverId === folder.id;
              return (
                <li key={folder.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectFolder(folder.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectFolder(folder.id);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverId(folder.id);
                    }}
                    onDragLeave={() => setDragOverId((prev) => (prev === folder.id ? null : prev))}
                    onDrop={(e) => handleDrop(e, folder)}
                    className={`group flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                      selected
                        ? 'border-primary-300 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    } ${isDragOver ? 'ring-2 ring-primary-400 border-primary-400 bg-primary-50/70' : ''}`}
                  >
                    <span className="truncate font-medium">{folder.name}</span>
                    <span className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-medium text-slate-400">
                        {inFolderCount(folder)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete folder ${folder.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete folder "${folder.name}"?`)) {
                            deleteFolder(folder.id);
                            if (selectedFolderId === folder.id) onSelectFolder(null);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          Tip: drag a {typeLabelLower.replace(/s$/, '')} onto a folder to move it — it will be removed
          from the All list. Click a folder to open its {typeLabelLower}. Drop on “All” to send it
          back.
        </p>
      </div>
    </div>
  );
}
