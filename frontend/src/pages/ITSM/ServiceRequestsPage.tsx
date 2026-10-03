import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { isCatalogTask } from '../../utils/itsmSections';
import NewServiceRequestPage from './NewServiceRequestPage';
import { STATE_LABEL, readJson, stamp, taskKey, NO_TASK, type TaskFields } from './serviceRequestShared';

/** /tickets/service-requests/:view — "create-new" and "tasks" (the plain request list is TicketsPage). */
export default function ServiceRequestsPage() {
  const { view } = useParams();
  const dispatch = useAppDispatch();
  const { tickets } = useAppSelector((s) => s.itsm);

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  if (view === 'create-new') return <NewServiceRequestPage />;
  if (view !== 'tasks') return <Navigate to="/tickets/service-requests" replace />;

  const tasks = tickets.filter(isCatalogTask);
  const th = 'whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold text-slate-900';
  const td = 'px-2.5 py-1.5 align-top text-[11px] text-slate-800';
  const parentCode = (id: number) => {
    const link = readJson<TaskFields>(taskKey(id), NO_TASK).requestItem;
    return link == null ? undefined : tickets.find((t) => t.id === link);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-900">Service Request · Catalog Tasks</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-300">
              {['Number', 'Short description', 'Request item', 'State', 'Assigned to', 'Opened'].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => {
              const parent = parentCode(t.id);
              return (
                <tr key={t.id} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50' : ''}`}>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link to={`/tickets/service-requests/tasks/${t.id}`} className="font-medium text-primary-700 hover:underline">
                      {t.ticketCode}
                    </Link>
                  </td>
                  <td className={`${td} max-w-xs`}>{t.title}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {parent ? (
                      <Link to={`/tickets/service-requests/items/${parent.id}`} className="text-primary-700 hover:underline">
                        {parent.ticketCode}
                      </Link>
                    ) : (
                      '(empty)'
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{STATE_LABEL[t.status]}</td>
                  <td className={td}>{t.assignedTo || '(empty)'}</td>
                  <td className={`${td} whitespace-nowrap`}>{stamp(t.createdAt)}</td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-xs text-slate-400">
                  No catalog tasks yet. Open a requested item and use New under Catalog Tasks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
