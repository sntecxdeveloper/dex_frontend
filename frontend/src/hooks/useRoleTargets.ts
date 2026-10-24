import { useEffect, useState } from 'react';
import { getAccessRoles } from '../api/accessApi';

export interface RoleTarget {
  /** The key layouts are stored under: the sign-in role (ROLE_...) or ACCESS_<id> for a named role. */
  value: string;
  label: string;
}

const BUILT_IN: RoleTarget[] = [
  { value: 'ROLE_ADMIN', label: 'Administrators' },
  { value: 'ROLE_OPERATOR', label: 'Operators' },
  { value: 'ROLE_ITSM_TECHNICIAN', label: 'ITSM technicians' },
  { value: 'ROLE_VIEWER', label: 'Viewers' },
];

/** Every role a default (layout, colors) can be saved for: the built-in sign-in roles and the named roles from Roles. */
export function useRoleTargets(enabled = true): RoleTarget[] {
  const [named, setNamed] = useState<RoleTarget[]>([]);
  useEffect(() => {
    if (!enabled) return;
    getAccessRoles()
      .then((roles) => setNamed(roles.filter((r) => !r.builtIn).map((r) => ({ value: `ACCESS_${r.id}`, label: r.name }))))
      .catch(() => setNamed([]));
  }, [enabled]);
  return [...BUILT_IN, ...named];
}
