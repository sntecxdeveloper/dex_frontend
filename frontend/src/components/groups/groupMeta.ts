import type { GroupHealth, GroupKind, GroupSection } from '../../types/group';

export const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export const KINDS: GroupKind[] = ['DEPARTMENT', 'SITE', 'REGION', 'TEAM', 'PROJECT', 'CUSTOMER', 'CUSTOM'];

export const KIND_INFO: Record<GroupKind, { label: string; plural: string }> = {
  DEPARTMENT: { label: 'Department', plural: 'Departments' },
  SITE: { label: 'Site / location', plural: 'Sites' },
  REGION: { label: 'Region', plural: 'Regions' },
  TEAM: { label: 'Team', plural: 'Teams' },
  PROJECT: { label: 'Project', plural: 'Projects' },
  CUSTOMER: { label: 'Customer', plural: 'Customers' },
  CUSTOM: { label: 'Other', plural: 'Other' },
};

/** The three things inside a group, in the order they are shown. */
export const SECTIONS: GroupSection[] = ['DEVICE', 'TECHNICIAN', 'USER'];

export const SECTION_INFO: Record<GroupSection, { title: string; one: string; many: string; blurb: string }> = {
  DEVICE: { title: 'Devices', one: 'device', many: 'devices', blurb: 'The computers that belong to this group' },
  TECHNICIAN: { title: 'Technicians', one: 'technician', many: 'technicians', blurb: 'Who handles the issues of these devices' },
  USER: { title: 'Users', one: 'user', many: 'users', blurb: 'The people who use these devices' },
};

export const HEALTH_INFO: Record<GroupHealth, { label: string; text: string; ring: string }> = {
  HEALTHY: { label: 'Healthy', text: 'text-emerald-700', ring: 'bg-emerald-50 ring-emerald-200' },
  WARNING: { label: 'Needs attention', text: 'text-amber-700', ring: 'bg-amber-50 ring-amber-200' },
  CRITICAL: { label: 'Critical', text: 'text-red-700', ring: 'bg-red-50 ring-red-200' },
  EMPTY: { label: 'No devices', text: 'text-slate-500', ring: 'bg-slate-50 ring-slate-200' },
};

export const OPERATOR_LABEL: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  is_true: 'is on / yes',
  is_false: 'is off / no',
};

export const EDITOR_ROLES = ['ROLE_ADMIN', 'ROLE_OPERATOR'];

export function canEditGroups(role?: string | null): boolean {
  return !!role && EDITOR_ROLES.includes(role);
}

/** Two letters for the coloured badge: "Finance Laptops" gives "FL". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "3 technicians" / "1 technician". */
export function countLabel(section: GroupSection, n: number): string {
  return `${n} ${n === 1 ? SECTION_INFO[section].one : SECTION_INFO[section].many}`;
}
