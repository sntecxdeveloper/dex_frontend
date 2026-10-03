import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteGroup,
  getGroup,
  getGroupDevices,
  getGroupPeople,
  getRuleFields,
  removeGroupMember,
} from '../../api/groupApi';
import { getLogsByEntityType, type AuditLog } from '../../api/auditApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import AddMembersModal from '../../components/groups/AddMembersModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import GroupFormModal from '../../components/groups/GroupFormModal';
import GroupRunModal from '../../components/groups/GroupRunModal';
import { HEALTH_INFO, MODE_INFO, OPERATOR_LABEL, TYPE_INFO, canEditGroups, initials } from '../../components/groups/groupMeta';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { toast } from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';
import { ROLE_COLORS, ROLE_LABELS, STATUS_COLORS } from '../../utils/constants';
import type { GroupDetail, GroupDeviceMember, GroupPersonMember, GroupRule, RuleFieldInfo } from '../../types/group';

type Tab = 'overview' | 'members' | 'activity';

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className={`font-display text-[26px] font-semibold leading-none ${tone ?? 'text-slate-900'}`}>{value}</p>
      <p className="mt-1.5 text-[12px] text-slate-500">{label}</p>
    </div>
  );
}

/** "Operating system contains Windows" for each condition, so a dynamic group's rule reads like a sentence. */
function RuleSummary({ rule, fields }: { rule: GroupRule; fields: RuleFieldInfo[] }) {
  const label = (key: string) => fields.find((f) => f.key === key)?.label ?? key;
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-slate-700">
        Includes anything where <strong>{rule.match === 'ALL' ? 'all' : 'any'}</strong> of these are true:
      </p>
      <ul className="space-y-1.5">
        {rule.conditions.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-[13px] text-slate-700">
            <span className="font-medium text-slate-900">{label(c.field)}</span>
            <span className="text-slate-500">{OPERATOR_LABEL[c.op] ?? c.op}</span>
            {c.value && <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-slate-800 ring-1 ring-inset ring-slate-200">{c.value.replace('ROLE_', '')}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GroupDetailsPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const navigate = useNavigate();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [devices, setDevices] = useState<GroupDeviceMember[]>([]);
  const [people, setPeople] = useState<GroupPersonMember[]>([]);
  const [fields, setFields] = useState<RuleFieldInfo[]>([]);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [logsDenied, setLogsDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getGroup(groupId);
      setDetail(d);
      setError(null);
      if (d.summary.groupType === 'DEVICE') setDevices(await getGroupDevices(groupId));
      else setPeople(await getGroupPeople(groupId));
      getRuleFields(d.summary.groupType).then(setFields).catch(() => undefined);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [groupId]);

  useEffect(() => {
    if (Number.isFinite(groupId)) void load();
  }, [groupId, load]);

  useEffect(() => {
    if (tab !== 'activity' || logs !== null) return;
    getLogsByEntityType('Group')
      .then((all) => setLogs(all.filter((l) => l.entityId === groupId).slice(0, 50)))
      .catch(() => {
        setLogs([]);
        setLogsDenied(true);
      });
  }, [tab, logs, groupId]);

  const summary = detail?.summary;
  const isDevice = summary?.groupType === 'DEVICE';
  const isStatic = summary?.membershipMode === 'STATIC';
  const color = summary?.color || '#64748b';

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => !q || d.hostname?.toLowerCase().includes(q) || d.agentId.toLowerCase().includes(q) || (d.os ?? '').toLowerCase().includes(q));
  }, [devices, search]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => !q || p.username.toLowerCase().includes(q) || (p.fullName ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q));
  }, [people, search]);

  const existingKeys = useMemo(() => new Set(isDevice ? devices.map((d) => d.agentId) : people.map((p) => p.username)), [isDevice, devices, people]);

  const remove = async (key: string) => {
    try {
      await removeGroupMember(groupId, key);
      toast('Removed from the group', 'success');
      void load();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteGroup(groupId);
      toast('Group deleted', 'success');
      navigate('/groups');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const badId = !Number.isFinite(groupId);
  if ((error || badId) && !detail) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-line bg-panel p-8 text-center">
        <p className="text-sm font-medium text-slate-800">{badId ? 'That is not a valid group.' : error}</p>
        <Link to="/groups" className="mt-4 inline-block text-xs font-medium text-primary-600 hover:text-primary-700">
          Back to groups
        </Link>
      </div>
    );
  }

  if (!detail || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const health = HEALTH_INFO[summary.health ?? 'EMPTY'];
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'members', label: `${TYPE_INFO[summary.groupType].plural} (${summary.memberCount})` },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div className="space-y-5">
      <Link to="/groups" className="text-xs font-medium text-slate-500 hover:text-slate-800">
        ← All groups
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold text-white" style={{ backgroundColor: color }} aria-hidden="true">
            {initials(summary.name)}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-slate-900">{summary.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
              <span>{TYPE_INFO[summary.groupType].label}</span>
              <span className="text-slate-300">·</span>
              <span className={summary.membershipMode === 'DYNAMIC' ? 'text-primary-600' : ''}>{MODE_INFO[summary.membershipMode].label}</span>
              {isDevice && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${health.ring} ${health.text}`}>{health.label}</span>
              )}
            </p>
            {summary.description && <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{summary.description}</p>}
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {isDevice && (
              <Button size="sm" onClick={() => setRunning(true)} disabled={summary.memberCount === 0}>
                Run a fix
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={isDevice ? 'Devices' : 'People'} value={summary.memberCount} />
        {isDevice ? (
          <>
            <Stat label="Online" value={summary.online ?? 0} tone="text-emerald-600" />
            <Stat label="Offline" value={summary.offline ?? 0} tone={(summary.offline ?? 0) > 0 ? 'text-amber-600' : undefined} />
            <Stat label="Open issues" value={summary.openIssues ?? 0} tone={(summary.openIssues ?? 0) > 0 ? 'text-red-600' : undefined} />
          </>
        ) : (
          <>
            <Stat label="Enabled accounts" value={people.filter((p) => p.enabled).length} />
            <Stat label="Disabled accounts" value={people.filter((p) => !p.enabled).length} />
            <Stat label="Membership" value={MODE_INFO[summary.membershipMode].label} />
          </>
        )}
      </div>

      <div className="border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
              tab === t.key ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-sm font-semibold text-slate-800">Who is in this group</h2>
            <div className="mt-3">
              {summary.membershipMode === 'DYNAMIC' && detail.rule ? (
                <RuleSummary rule={detail.rule} fields={fields} />
              ) : (
                <p className="text-[13px] text-slate-600">
                  Members are listed by hand. {canEdit ? 'Use the members tab to add or remove them.' : 'An administrator or operator manages the list.'}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-sm font-semibold text-slate-800">Details</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Created by</dt>
                <dd className="text-slate-800">{detail.createdBy || 'Unknown'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-800">{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Last changed</dt>
                <dd className="text-slate-800">{formatRelativeTime(summary.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isDevice ? 'Search devices…' : 'Search people…'}
              aria-label="Search members"
              className="h-10 w-full max-w-sm rounded-lg border border-line bg-panel px-3 text-[13px] placeholder:text-slate-400 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {canEdit && isStatic && (
              <Button size="sm" onClick={() => setAdding(true)}>
                Add {isDevice ? 'devices' : 'people'}
              </Button>
            )}
          </div>
          {!isStatic && (
            <p className="rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2 text-xs text-primary-800">
              This group is dynamic: the list below follows its rule. To change who is in it, edit the rule.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-line bg-panel">
            {isDevice ? (
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Computer</th>
                    <th className="px-4 py-2.5 font-medium">System</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Last seen</th>
                    <th className="px-4 py-2.5 font-medium">Issues</th>
                    {canEdit && isStatic && <th className="w-10 px-2" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((d) => (
                    <tr key={d.agentId} className="border-b border-line/60 last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link to={`/devices/${d.id}`} className="font-medium text-slate-900 hover:text-primary-700">
                          {d.hostname || d.agentId}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{d.os ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[d.status ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{d.status ?? 'Unknown'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{formatRelativeTime(d.lastHeartbeat)}</td>
                      <td className="px-4 py-2.5">{d.openIssues > 0 ? <span className="font-medium text-red-600">{d.openIssues}</span> : <span className="text-slate-400">0</span>}</td>
                      {canEdit && isStatic && (
                        <td className="px-2">
                          <button type="button" onClick={() => void remove(d.agentId)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${d.hostname}`} title="Remove from group">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Username</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Account</th>
                    {canEdit && isStatic && <th className="w-10 px-2" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map((p) => (
                    <tr key={p.username} className="border-b border-line/60 last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{p.fullName || p.username}</p>
                        {p.email && <p className="text-[11px] text-slate-500">{p.email}</p>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-slate-600">{p.username}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[p.role ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{ROLE_LABELS[p.role ?? ''] ?? p.role}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p.enabled ? 'Enabled' : 'Disabled'}</td>
                      {canEdit && isStatic && (
                        <td className="px-2">
                          <button type="button" onClick={() => void remove(p.username)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${p.username}`} title="Remove from group">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(isDevice ? filteredDevices.length : filteredPeople.length) === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {search ? 'Nothing matches that search.' : isStatic ? 'No members yet.' : 'Nobody matches the rule right now.'}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="rounded-xl border border-line bg-panel">
          {logs === null ? (
            <Skeleton className="m-4 h-24" />
          ) : logsDenied ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">The activity history is visible to administrators.</p>
          ) : logs.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No recorded activity for this group yet.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] text-slate-800">{l.details}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">by {l.username}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <GroupFormModal
          existing={detail}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast('Group saved', 'success');
            void load();
          }}
        />
      )}
      {adding && (
        <AddMembersModal
          groupId={groupId}
          type={summary.groupType}
          existing={existingKeys}
          onClose={() => setAdding(false)}
          onAdded={(added, skipped) => {
            setAdding(false);
            toast(added > 0 ? `Added ${added}` : 'Nothing was added', added > 0 ? 'success' : 'info');
            if (skipped.length > 0) toast(skipped.slice(0, 2).join('; '), 'warning');
            void load();
          }}
        />
      )}
      {running && <GroupRunModal group={summary} onClose={() => setRunning(false)} />}
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this group?"
        message={`"${summary.name}" will be removed. The ${isDevice ? 'devices' : 'people'} in it are not affected.`}
        confirmLabel="Delete group"
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
