import { useState, useSyncExternalStore } from 'react';
import { subscribeFolders, getFolders, createFolder, type KbFolderType } from '../../stores/kbFolders';

const CREATE_VALUE = '__create__';

export default function FolderLocationField({
  type,
  value,
  onChange,
  label = 'Location',
  required = true,
  emptyLabel = 'None (All)',
  accentClassName = 'focus:ring-primary-500/20 focus:border-primary-400',
  buttonClassName = 'bg-primary-600 hover:bg-primary-700',
}: {
  type: KbFolderType;
  value: string;
  onChange: (folderId: string) => void;
  label?: string;
  required?: boolean;
  emptyLabel?: string;
  accentClassName?: string;
  buttonClassName?: string;
}) {
  useSyncExternalStore(subscribeFolders, getFolders);
  const folders = getFolders().filter((f) => f.type === type);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSelect = (raw: string) => {
    if (raw === CREATE_VALUE) {
      setCreating(true);
      return;
    }
    onChange(raw);
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const folder = createFolder(trimmed, type);
    onChange(folder.id);
    setCreating(false);
    setNewName('');
  };

  const cancelCreate = () => {
    setCreating(false);
    setNewName('');
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {creating ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
              if (e.key === 'Escape') cancelCreate();
            }}
            placeholder="New folder name"
            className={`flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${accentClassName}`}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className={`flex-shrink-0 px-2.5 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 ${buttonClassName}`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={cancelCreate}
            className="flex-shrink-0 px-2 py-2 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => handleSelect(e.target.value)}
          className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${accentClassName}`}
        >
          <option value="">{emptyLabel}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
          <option value={CREATE_VALUE}>+ Create new folder…</option>
        </select>
      )}
    </div>
  );
}
