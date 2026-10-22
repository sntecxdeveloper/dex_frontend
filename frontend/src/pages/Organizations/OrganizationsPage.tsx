import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrganization, getOrganizations } from '../../api/organizationApi';
import EnrollmentTokenModal from '../../components/organizations/EnrollmentTokenModal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { Skeleton } from '../../components/ui/Skeleton';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../../components/common/Toast';
import type { CreatedOrganization, Organization } from '../../types/organization';

/**
 * The customer companies the product is offered to. Each has its own devices, its own enrollment token (carried by the installer built
 * for that company) and its own agent view. Administrators only.
 */
export default function OrganizationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Organization[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedOrganization | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getOrganizations());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const result = await createOrganization(name.trim());
      setCreating(false);
      setName('');
      setCreated(result);
      toast(`${result.organization.name} was created`, 'success');
      void load();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organizations</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            The customer companies you offer the product to. Each one has its own devices, its own enrollment token and its own agent view.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New organization</Button>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <Panel padded={false}>
        {!items ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Organization</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Devices</th>
                  <th className="px-3 py-3 font-medium">Enrollment token</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onClick={() => navigate(`/organizations/${o.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/organizations/${o.id}`)}
                    className="cursor-pointer border-b border-line/60 last:border-b-0 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">
                        {o.name} {o.isDefault && <Badge tone="neutral">Default</Badge>}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">{o.code}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={o.status === 'ACTIVE' ? 'success' : 'warning'} dot>
                        {o.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{o.devices}</td>
                    <td className="px-3 py-3 font-mono text-[12px] text-slate-600">
                      {o.isDefault ? <span className="font-sans text-slate-500">Shared token (set on the server)</span> : o.hasToken ? `••••${o.tokenHint ?? ''}` : 'none'}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-xs text-slate-500">
        Devices that were installed before organizations existed are in the <strong>Default organization</strong>. Organizations share one console: they separate devices and
        agent views, not what administrators can see.
      </p>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={() => !busy && setCreating(false)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label="New organization"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">New organization</h2>
            <p className="mt-1 text-sm text-slate-500">Use the company's name. You get its enrollment token next, shown once.</p>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
                placeholder="Acme Ltd"
                className="h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 focus:border-primary-400 focus:outline-none"
              />
            </label>
            {formError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={name.trim().length < 2}>
                Create
              </Button>
            </div>
          </form>
        </div>
      )}

      {created && (
        <EnrollmentTokenModal
          organizationName={created.organization.name}
          token={created.enrollmentToken}
          onClose={() => {
            const id = created.organization.id;
            setCreated(null);
            navigate(`/organizations/${id}`);
          }}
        />
      )}
    </div>
  );
}
