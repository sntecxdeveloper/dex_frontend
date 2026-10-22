import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  clearOrganizationFeatures,
  deleteOrganization,
  getOrganization,
  getOrganizationDevices,
  getOrganizationFeatures,
  getOrganizations,
  moveDevicesToOrganization,
  rotateOrganizationToken,
  setOrganizationFeatures,
  updateOrganization,
} from '../../api/organizationApi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { toast } from '../../components/common/Toast';
import FeaturesPanel, { type FeaturesSource } from '../../components/groups/FeaturesPanel';
import EnrollmentTokenModal from '../../components/organizations/EnrollmentTokenModal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatRelativeTime } from '../../utils/formatDate';
import { getErrorMessage } from '../../utils/errorHandler';
import type { CreatedOrganization, Organization, OrganizationDevice } from '../../types/organization';

type Tab = 'overview' | 'devices' | 'view';

const ORGANIZATION_FEATURES: FeaturesSource = { get: getOrganizationFeatures, set: setOrganizationFeatures, clear: clearOrganizationFeatures };

/** One customer company: its settings and enrollment token, the devices it owns, and what its agents show. */
export default function OrganizationDetailsPage() {
  const { id } = useParams();
  const organizationId = Number(id);
  const navigate = useNavigate();
  const [org, setOrg] = useState<Organization | null>(null);
  const [all, setAll] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [shownToken, setShownToken] = useState<CreatedOrganization | null>(null);
  const [confirm, setConfirm] = useState<'token' | 'delete' | 'suspend' | null>(null);

  const load = useCallback(async () => {
    try {
      const [one, list] = await Promise.all([getOrganization(organizationId), getOrganizations()]);
      setOrg(one);
      setAll(list);
      setName(one.name);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await action();
      if (done) toast(done, 'success');
      await load();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (error && !org) {
    return (
      <div className="space-y-3">
        <Link to="/organizations" className="text-sm text-primary-600 hover:text-primary-700">
          ← Organizations
        </Link>
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      </div>
    );
  }
  if (!org) return <Skeleton className="h-64" />;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'devices', label: `Devices (${org.devices})` },
    { key: 'view', label: 'Agent view' },
  ];
  const renamed = name.trim() !== org.name && name.trim().length >= 2;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/organizations" className="text-sm text-primary-600 hover:text-primary-700">
          ← Organizations
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
          {org.isDefault && <Badge tone="neutral">Default</Badge>}
          <Badge tone={org.status === 'ACTIVE' ? 'success' : 'warning'} dot>
            {org.status === 'ACTIVE' ? 'Active' : 'Suspended'}
          </Badge>
          <span className="text-sm text-slate-500">
            {org.devices} device{org.devices === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${tab === t.key ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <Panel>
            <h3 className="text-sm font-semibold text-slate-800">Name</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
                aria-label="Organization name"
                className="h-10 w-72 max-w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 focus:border-primary-400 focus:outline-none"
              />
              <Button size="sm" disabled={!renamed || busy} onClick={() => void run(async () => void (await updateOrganization(org.id, { name: name.trim() })), 'Name saved')}>
                Save
              </Button>
            </div>
          </Panel>

          <Panel>
            <h3 className="text-sm font-semibold text-slate-800">Enrollment token</h3>
            {org.isDefault ? (
              <p className="mt-1 text-sm text-slate-600">
                The Default organization has no token of its own: new devices join it with the shared token set on the server (<code className="font-mono text-[12px]">AGENT_ENROLLMENT_TOKEN</code>).
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-slate-600">
                  The installer built for this company carries its token, so its PCs join this organization on their own.
                  {org.hasToken && (
                    <>
                      {' '}
                      Current token ends in <code className="font-mono text-[12px]">{org.tokenHint}</code>. It cannot be read again.
                    </>
                  )}
                </p>
                <div className="mt-3">
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirm('token')}>
                    Make a new token
                  </Button>
                </div>
              </>
            )}
          </Panel>

          {!org.isDefault && (
            <Panel>
              <h3 className="text-sm font-semibold text-slate-800">Status</h3>
              <p className="mt-1 text-sm text-slate-600">
                {org.status === 'ACTIVE'
                  ? 'While active, this company\'s token enrolls new devices. Suspending stops new devices from joining; devices already enrolled keep working.'
                  : 'This organization is suspended: its token does not enroll new devices. Devices already enrolled keep working.'}
              </p>
              <div className="mt-3">
                {org.status === 'ACTIVE' ? (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirm('suspend')}>
                    Suspend
                  </Button>
                ) : (
                  <Button size="sm" disabled={busy} onClick={() => void run(async () => void (await updateOrganization(org.id, { status: 'ACTIVE' })), 'Organization reactivated')}>
                    Reactivate
                  </Button>
                )}
              </div>
            </Panel>
          )}

          {!org.isDefault && (
            <Panel>
              <h3 className="text-sm font-semibold text-slate-800">Delete</h3>
              <p className="mt-1 text-sm text-slate-600">
                {org.devices > 0 ? `Move its ${org.devices} device${org.devices === 1 ? '' : 's'} to another organization first (Devices tab).` : 'An organization with no devices can be deleted. Its agent view goes with it.'}
              </p>
              <div className="mt-3">
                <Button variant="danger" size="sm" disabled={busy || org.devices > 0} onClick={() => setConfirm('delete')}>
                  Delete organization
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {tab === 'devices' && <DevicesTab org={org} all={all} onMoved={() => void load()} />}

      {tab === 'view' && (
        <>
          <FeaturesPanel groupId={org.id} groupName={org.name} canEdit source={ORGANIZATION_FEATURES} noun="organization" onChanged={() => void load()} />
        </>
      )}

      <ConfirmDialog
        isOpen={confirm === 'token'}
        title="Make a new token?"
        message="The old token stops working at once, so an installer built with it can no longer enroll new PCs. PCs already enrolled keep working. You will build a new installer with the new token."
        confirmLabel="Make a new token"
        variant="warning"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(async () => setShownToken(await rotateOrganizationToken(org.id)));
        }}
      />
      <ConfirmDialog
        isOpen={confirm === 'suspend'}
        title={`Suspend ${org.name}?`}
        message="Its token will stop enrolling new devices. Devices already enrolled keep working. You can reactivate it at any time."
        confirmLabel="Suspend"
        variant="warning"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(async () => void (await updateOrganization(org.id, { status: 'SUSPENDED' })), 'Organization suspended');
        }}
      />
      <ConfirmDialog
        isOpen={confirm === 'delete'}
        title={`Delete ${org.name}?`}
        message="This cannot be undone. Its enrollment token and agent view are removed."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(async () => {
            await deleteOrganization(org.id);
            toast('Organization deleted', 'success');
            navigate('/organizations');
          });
        }}
      />

      {shownToken && <EnrollmentTokenModal organizationName={shownToken.organization.name} token={shownToken.enrollmentToken} replaced onClose={() => setShownToken(null)} />}
    </div>
  );
}

/** The devices this organization owns, and a way to bring in devices from other organizations. */
function DevicesTab({ org, all, onMoved }: { org: Organization; all: Organization[]; onMoved: () => void }) {
  const [mine, setMine] = useState<OrganizationDevice[] | null>(null);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<OrganizationDevice[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    try {
      setMine(await getOrganizationDevices({ organizationId: org.id }));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [org.id]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  // Search every device (not just this organization's) so devices can be brought in.
  useEffect(() => {
    if (search.trim().length < 2) {
      setFound([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getOrganizationDevices({ q: search.trim() })
        .then((list) => !cancelled && setFound(list.filter((d) => d.organizationId !== org.id)))
        .catch((err) => !cancelled && setError(getErrorMessage(err)));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, org.id]);

  const others = useMemo(() => all.filter((o) => o.id !== org.id && o.status === 'ACTIVE'), [all, org.id]);

  const toggle = (agentId: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });

  const move = async (organizationId: number, agentIds: string[]) => {
    setBusy(true);
    try {
      const result = await moveDevicesToOrganization(organizationId, agentIds);
      toast(`${result.moved} device${result.moved === 1 ? '' : 's'} moved`, 'success');
      setPicked(new Set());
      setSearch('');
      await loadMine();
      onMoved();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const mineIds = [...picked].filter((a) => mine?.some((d) => d.agentId === a));
  const foundIds = [...picked].filter((a) => found.some((d) => d.agentId === a));

  const row = (d: OrganizationDevice, showOrg: boolean) => (
    <tr key={d.agentId} className="border-b border-line/60 last:border-b-0">
      <td className="w-8 py-2.5 pl-5">
        <input type="checkbox" checked={picked.has(d.agentId)} onChange={() => toggle(d.agentId)} aria-label={`Select ${d.hostname}`} className="h-4 w-4 accent-sky-600" />
      </td>
      <td className="py-2.5 pr-4">
        <p className="font-medium text-slate-900">{d.hostname}</p>
        <p className="font-mono text-[11px] text-slate-500">{d.agentId}</p>
      </td>
      <td className="py-2.5 pr-4 text-slate-600">{d.os ?? ''}</td>
      {showOrg && <td className="py-2.5 pr-4 text-slate-700">{d.organizationName}</td>}
      <td className="py-2.5 pr-5 text-slate-500">{d.lastHeartbeat ? formatRelativeTime(d.lastHeartbeat) : 'never'}</td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-[13px] font-medium text-slate-800">Devices in {org.name}</p>
          <div className="flex items-center gap-2">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : '')}
              aria-label="Move the selected devices to"
              className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-slate-700"
            >
              <option value="">Move selected to…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" disabled={busy || target === '' || mineIds.length === 0} onClick={() => target !== '' && void move(target, mineIds)}>
              Move {mineIds.length > 0 ? mineIds.length : ''}
            </Button>
          </div>
        </div>
        {!mine ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : mine.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No devices yet. PCs that run this company's installer appear here, or bring devices in below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8 py-2 pl-5" />
                  <th className="py-2 pr-4 font-medium">Device</th>
                  <th className="py-2 pr-4 font-medium">System</th>
                  <th className="py-2 pr-5 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>{mine.map((d) => row(d, false))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-[13px] font-medium text-slate-800">Bring devices in from other organizations</p>
          <Button size="sm" disabled={busy || foundIds.length === 0} onClick={() => void move(org.id, foundIds)}>
            Move {foundIds.length > 0 ? foundIds.length : ''} into {org.name}
          </Button>
        </div>
        <div className="px-5 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by device name or agent id (at least 2 characters)"
            aria-label="Search devices"
            className="h-9 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 focus:border-primary-400 focus:outline-none"
          />
        </div>
        {search.trim().length >= 2 &&
          (found.length === 0 ? (
            <p className="pb-5 text-center text-sm text-slate-500">No devices from other organizations match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-y border-line text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-8 py-2 pl-5" />
                    <th className="py-2 pr-4 font-medium">Device</th>
                    <th className="py-2 pr-4 font-medium">System</th>
                    <th className="py-2 pr-4 font-medium">Now in</th>
                    <th className="py-2 pr-5 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>{found.map((d) => row(d, true))}</tbody>
              </table>
            </div>
          ))}
      </Panel>
    </div>
  );
}
