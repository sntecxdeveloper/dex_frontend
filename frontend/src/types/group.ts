export type GroupType = 'DEVICE' | 'TECHNICIAN' | 'USER';
export type MembershipMode = 'STATIC' | 'DYNAMIC';
export type GroupHealth = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EMPTY';

export interface GroupSummary {
  id: number;
  name: string;
  description?: string | null;
  groupType: GroupType;
  membershipMode: MembershipMode;
  color?: string | null;
  icon?: string | null;
  memberCount: number;
  /** Device groups only. */
  online?: number | null;
  offline?: number | null;
  devicesWithIssues?: number | null;
  openIssues?: number | null;
  health?: GroupHealth | null;
  updatedAt?: string;
}

export interface RuleCondition {
  field: string;
  op: string;
  value: string;
}

export interface GroupRule {
  match: 'ALL' | 'ANY';
  conditions: RuleCondition[];
}

/** What a device group applies to its devices. */
export interface GroupPolicy {
  /** Days to keep logs; null means the platform default. */
  retentionDays: number | null;
  /** Fix keys the devices may use; null means every approved fix. */
  allowedScripts: string[] | null;
  /** Technician group that takes the issues; null means nobody. */
  ownerGroupId: number | null;
  ownerGroupName?: string | null;
}

export interface GroupDetail {
  summary: GroupSummary;
  rule?: GroupRule | null;
  policy?: GroupPolicy | null;
  createdBy?: string | null;
  createdAt?: string;
}

export interface GroupDeviceMember {
  id: number;
  agentId: string;
  hostname: string;
  os?: string | null;
  status?: string | null;
  lastHeartbeat?: string | null;
  openIssues: number;
  source: MembershipMode;
}

export interface GroupPersonMember {
  username: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  enabled: boolean;
  source: MembershipMode;
}

export interface RuleFieldInfo {
  key: string;
  label: string;
  kind: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';
  options: string[];
  operators: string[];
}

export interface GroupRequest {
  name: string;
  description?: string;
  groupType: GroupType;
  membershipMode: MembershipMode;
  rule?: GroupRule | null;
  color?: string;
  icon?: string;
}

export interface RulePreview {
  total: number;
  sample: { name: string; detail?: string }[];
}

export interface GroupCandidate {
  key: string;
  name: string;
  detail?: string;
}
