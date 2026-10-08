import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteGroup,
  getGroup,
  getGroupDevices,
  getGroupPeople,
  removeGroupMember,
  updateGroup,
} from '../../api/groupApi';
import { getLogsByEntityType, type AuditLog } from '../../api/auditApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import AddMembersModal from '../../components/groups/AddMembersModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import GroupFormModal from '../../components/groups/GroupFormModal';
import GroupRunModal from '../../components/groups/GroupRunModal';
import PolicyPanel from '../../components/groups/PolicyPanel';
import RuleBuilder from '../../components/groups/RuleBuilder';
import { EMPTY_RULE, ruleIsComplete } from '../../components/groups/ruleUtils';
import { getRuleFields } from '../../api/groupApi';
import { HEALTH_INFO, KIND_INFO, SECTIONS, SECTION_INFO, TYPE_INFO, canEditGroups, countLabel, initials, sectionsFor } from '../../components/groups/groupMeta';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { toast } from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';
import { ROLE_COLORS, ROLE_LABELS, STATUS_COLORS } from '../../utils/constants';
import type {
  GroupDetail,
  GroupDeviceMember,
  GroupPersonMember,
  GroupRule,
  GroupSection,
  MembershipMode,
  RuleFieldInfo,
} from '../../types/group';

type Tab = 'inside' | 'policies' | 'activity';

const selectClass =
  'h-9 rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className={`font-display text-[26px] font-semibold leading-none ${tone ?? 'text-slate-900'}`}>{value}</p>
      <p className="mt-1.5 text-[12px] text-slate-500">{label}</p>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={label} title="Remove from group">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/** One dropdown section inside the group: its heading with a count, and when open its members. */
function SectionShell({
  section,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  section: GroupSection;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const info = SECTION_INFO[section];
  return (
    <section className="rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Chevron open={open} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">
              {info.title} <span className="ml-1 font-mono text-[12px] font-normal text-slate-500">{count}</span>
            </span>
            <span className="block text-[11px] text-slate-500">{info.blurb}</span>
          </span>
        </button>
        {action}
      </div>
      {open && <div className="border-t border-line px-5 py-4">{children}</div>}
    </section>
  );
}

/** "Operating system contains Windows" for each condition, so a rule reads like a sentence. */
function RuleSummary({ rule, fields }: { rule: GroupRule; fields: RuleFieldInfo[] }) {
  const label = (key: string) => fields.find((f) => f.key === key)?.label ?? key;
  return (
    <p className="text-[12px] text-slate-600">
      Devices where <strong>{rule.match === 'ALL' ? 'all' : 'any'}</strong> of these are true:{' '}
      {rule.conditions.map((c) => `${label(c.field)} ${c.op.replace(/_/g, ' ')}${c.value ? ' "' + c.value.replace('ROLE_', '') + '"' : ''}`).join('; ')}
    </p>
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
  const [technicians, setTechnicians] = useState<GroupPersonMember[]>([]);
  const [users, setUsers] = useState<GroupPersonMember[]>([]);
  const [fields, setFields] = useState<RuleFieldInfo[]>([]);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [logsDenied, setLogsDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('inside');
  const [openSections, setOpenSections] = useState<Set<GroupSection>>(new Set(['DEVICE']));

  // how devices are chosen: edited here, saved with the button
  const [mode, setMode] = useState<MembershipMode>('STATIC');
  const [rule, setRule] = useState<GroupRule>(EMPTY_RULE);
  const [savingRule, setSavingRule] = useState(false);

  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<GroupSection | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getGroup(groupId);
      setDetail(d);
      setMode(d.summary.membershipMode);
      setRule(d.rule ?? EMPTY_RULE);
      setError(null);
      const [dev, tech, usr] = await Promise.all([getGroupDevices(groupId), getGroupPeople(groupId, 'TECHNICIAN'), getGroupPeople(groupId, 'USER')]);
      setDevices(dev);
      setTechnicians(tech);
      setUsers(usr);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [groupId]);

  useEffect(() => {
    if (Number.isFinite(groupId)) void load();
  }, [groupId, load]);

  useEffect(() => {
    getRuleFields().then(setFields).catch(() => undefined);
  }, []);

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
  const devicesByRule = summary?.membershipMode === 'DYNAMIC';

  const keysOf = useMemo<Record<GroupSection, Set<string>>>(
    () => ({
      DEVICE: new Set(devices.map((d) => d.agentId)),
      TECHNICIAN: new Set(technicians.map((p) => p.username)),
      USER: new Set(users.map((p) => p.username)),
    }),
    [devices, technicians, users],
  );

  const toggleSection = (section: GroupSection) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  const remove = async (section: GroupSection, key: string) => {
    try {
      await removeGroupMember(groupId, section, key);
      toast('Removed from the group', 'success');
      void load();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const ruleChanged =
    !!detail && (mode !== detail.summary.membershipMode || (mode === 'DYNAMIC' && JSON.stringify(rule) !== JSON.stringify(detail.rule ?? EMPTY_RULE)));
  const ruleReady = mode === 'STATIC' || ruleIsComplete(rule, fields);

  const saveHowDevicesAreChosen = async () => {
    if (!detail) return;
    setSavingRule(true);
    try {
      await updateGroup(groupId, {
        name: detail.summary.name,
        description: detail.summary.description ?? undefined,
        kind: detail.summary.kind,
        color: detail.summary.color ?? undefined,
        membershipMode: mode,
        rule: mode === 'DYNAMIC' ? rule : null,
      });
      toast('Saved', 'success');
      await load();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setSavingRule(false);
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

  const color = summary.color || '#64748b';
  const health = HEALTH_INFO[summary.health];
  const tabs: { key: Tab; label: string }[] = [
    { key: 'inside', label: 'Inside this group' },
    { key: 'policies', label: 'Policies' },
    { key: 'activity', label: 'Activity' },
  ];

  const personTable = (section: Exclude<GroupSection, 'DEVICE'>, list: GroupPersonMember[]) =>
    list.length === 0 ? (
      <p className="py-4 text-center text-sm text-slate-500">No {SECTION_INFO[section].many} yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Username</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Account</th>
              {canEdit && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.username} className="border-b border-line/60 last:border-b-0">
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-slate-900">{p.fullName || p.username}</p>
                  {p.email && <p className="text-[11px] text-slate-500">{p.email}</p>}
                </td>
                <td className="py-2.5 pr-4 font-mono text-[12px] text-slate-600">{p.username}</td>
                <td className="py-2.5 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[p.role ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{ROLE_LABELS[p.role ?? ''] ?? p.role}</span>
                </td>
                <td className="py-2.5 pr-4 text-slate-600">{p.enabled ? 'Enabled' : 'Disabled'}</td>
                {canEdit && (
                  <td className="text-right">
                    <RemoveButton label={`Remove ${p.username}`} onClick={() => void remove(section, p.username)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const addButton = (section: GroupSection) =>
    canEdit && !(section === 'DEVICE' && devicesByRule) ? (
      <Button size="sm" variant="secondary" onClick={() => setAdding(section)}>
        Add
      </Button>
    ) : null;

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
              <span>{KIND_INFO[summary.kind].label}</span>
              {summary.type && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TYPE_INFO[summary.type].chip}`}>{TYPE_INFO[summary.type].label}</span>}
              {summary.status === 'INACTIVE' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">Inactive</span>}
              {summary.deviceCount > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${health.ring} ${health.text}`}>{health.label}</span>}
            </p>
            {summary.description && <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{summary.description}</p>}
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setRunning(true)} disabled={summary.deviceCount === 0}>
              Run a fix
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Devices" value={summary.deviceCount} />
        <Stat label="Online" value={summary.online} tone="text-emerald-600" />
        <Stat label="Open issues" value={summary.openIssues} tone={summary.openIssues > 0 ? 'text-red-600' : undefined} />
        <Stat label="Technicians" value={summary.technicianCount} />
        <Stat label="Users" value={summary.userCount} />
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

      {tab === 'inside' && (
        <div className="space-y-3">
          {sectionsFor(summary.type).map((section) => {
            const open = openSections.has(section);
            if (section === 'DEVICE') {
              return (
                <SectionShell key={section} section={section} count={devices.length} open={open} onToggle={() => toggleSection(section)} action={addButton(section)}>
                  <div className="space-y-3">
                    {canEdit ? (
                      <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-700">
                        <label htmlFor="how-devices" className="font-medium">
                          How are devices chosen?
                        </label>
                        <select id="how-devices" value={mode} onChange={(e) => setMode(e.target.value as MembershipMode)} className={selectClass}>
                          <option value="STATIC">I list them myself</option>
                          <option value="DYNAMIC">A rule picks them</option>
                        </select>
                      </div>
                    ) : (
                      detail.rule && <RuleSummary rule={detail.rule} fields={fields} />
                    )}
                    {canEdit && mode === 'DYNAMIC' && <RuleBuilder value={rule} onChange={setRule} />}
                    {canEdit && ruleChanged && (
                      <div className="flex items-center gap-3">
                        <Button size="sm" onClick={() => void saveHowDevicesAreChosen()} disabled={!ruleReady || savingRule} loading={savingRule}>
                          Save
                        </Button>
                        <button type="button" onClick={() => { setMode(detail.summary.membershipMode); setRule(detail.rule ?? EMPTY_RULE); }} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                          Undo
                        </button>
                        {mode === 'DYNAMIC' && detail.summary.membershipMode === 'STATIC' && summary.deviceCount > 0 && (
                          <span className="text-xs text-amber-700">Switching to a rule removes the devices you listed by hand.</span>
                        )}
                      </div>
                    )}

                    {devices.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500">{devicesByRule ? 'No device matches the rule right now.' : 'No devices yet.'}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="py-2 pr-4 font-medium">Computer</th>
                              <th className="py-2 pr-4 font-medium">System</th>
                              <th className="py-2 pr-4 font-medium">Status</th>
                              <th className="py-2 pr-4 font-medium">Last seen</th>
                              <th className="py-2 pr-4 font-medium">Issues</th>
                              {canEdit && !devicesByRule && <th className="w-10" />}
                            </tr>
                          </thead>
                          <tbody>
                            {devices.map((d) => (
                              <tr key={d.agentId} className="border-b border-line/60 last:border-b-0">
                                <td className="py-2.5 pr-4">
                                  <Link to={`/devices/${d.id}`} className="font-medium text-slate-900 hover:text-primary-700">
                                    {d.hostname || d.agentId}
                                  </Link>
                                </td>
                                <td className="py-2.5 pr-4 text-slate-600">{d.os ?? '—'}</td>
                                <td className="py-2.5 pr-4">
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[d.status ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{d.status ?? 'Unknown'}</span>
                                </td>
                                <td className="py-2.5 pr-4 text-slate-500">{formatRelativeTime(d.lastHeartbeat)}</td>
                                <td className="py-2.5 pr-4">{d.openIssues > 0 ? <span className="font-medium text-red-600">{d.openIssues}</span> : <span className="text-slate-400">0</span>}</td>
                                {canEdit && !devicesByRule && (
                                  <td className="text-right">
                                    <RemoveButton label={`Remove ${d.hostname}`} onClick={() => void remove('DEVICE', d.agentId)} />
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </SectionShell>
              );
            }
            const list = section === 'TECHNICIAN' ? technicians : users;
            return (
              <SectionShell key={section} section={section} count={list.length} open={open} onToggle={() => toggleSection(section)} action={addButton(section)}>
                {personTable(section, list)}
              </SectionShell>
            );
          })}
        </div>
      )}

      {tab === 'policies' && <PolicyPanel key={summary.updatedAt} detail={detail} canEdit={canEdit} onSaved={(d) => setDetail(d)} />}

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

      <p className="text-[11px] text-slate-400">
        Created by {detail.createdBy || 'unknown'} · {formatDateTime(detail.createdAt)} · {SECTIONS.map((s) => countLabel(s, s === 'DEVICE' ? summary.deviceCount : s === 'TECHNICIAN' ? summary.technicianCount : summary.userCount)).join(' · ')}
      </p>

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
          section={adding}
          existing={keysOf[adding]}
          onClose={() => setAdding(null)}
          onAdded={(added, skipped) => {
            setAdding(null);
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
        message={`"${summary.name}" will be removed. The devices and people in it are not affected.`}
        confirmLabel="Delete group"
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
