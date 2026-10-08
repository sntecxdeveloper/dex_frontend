import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { getUsers } from '../../api/userApi';
import { Button } from '../ui/Button';

export default function AssignTicketsModal({
  count,
  onClose,
  onAssign,
}: {
  count: number;
  onClose: () => void;
  /** Resolves when the assignment is done; rejects with a message to show. */
  onAssign: (assignee: string) => Promise<void>;
}) {
  const [users, setUsers] = useState<string[]>([]);
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsers()
      .then((u) => setUsers(u.filter((x) => x.enabled).map((x) => x.username)))
      .catch(() => setError('Could not load users.'));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAssign(assignee);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-slate-900">
          Assign {count} incident{count === 1 ? '' : 's'}
        </h2>
        <select
          autoFocus
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none"
        >
          <option value="">Select a user…</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!assignee} loading={busy}>
            Assign
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
