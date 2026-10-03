import type { GroupHealth, GroupType, MembershipMode } from '../../types/group';

export const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export const TYPE_INFO: Record<GroupType, { label: string; plural: string; blurb: string }> = {
  DEVICE: { label: 'Device group', plural: 'Devices', blurb: 'Computers and laptops running the agent' },
  TECHNICIAN: { label: 'Technician group', plural: 'Technicians', blurb: 'People who work on issues and tickets' },
  USER: { label: 'User group', plural: 'Users', blurb: 'Everyone else: teams, departments, viewers' },
};

export const MODE_INFO: Record<MembershipMode, { label: string; blurb: string }> = {
  STATIC: { label: 'Static', blurb: 'You choose the members' },
  DYNAMIC: { label: 'Dynamic', blurb: 'A rule decides, and it updates itself' },
};

export const HEALTH_INFO: Record<GroupHealth, { label: string; bar: string; text: string; ring: string }> = {
  HEALTHY: { label: 'Healthy', bar: 'bg-emerald-500', text: 'text-emerald-700', ring: 'bg-emerald-50 ring-emerald-200' },
  WARNING: { label: 'Needs attention', bar: 'bg-amber-500', text: 'text-amber-700', ring: 'bg-amber-50 ring-amber-200' },
  CRITICAL: { label: 'Critical', bar: 'bg-red-500', text: 'text-red-700', ring: 'bg-red-50 ring-red-200' },
  EMPTY: { label: 'No devices', bar: 'bg-slate-300', text: 'text-slate-500', ring: 'bg-slate-50 ring-slate-200' },
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
