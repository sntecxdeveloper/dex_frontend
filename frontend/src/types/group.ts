/** What sort of organisation unit a group is. Only a label and a filter. */
export type GroupKind = 'DEPARTMENT' | 'SITE' | 'TEAM' | 'PROJECT' | 'CUSTOMER' | 'CUSTOM';

/** How the devices of a group are chosen: listed by hand, or by a rule. */
export type MembershipMode = 'STATIC' | 'DYNAMIC';

/** The three sections inside a group. */
export type GroupSection = 'DEVICE' | 'TECHNICIAN' | 'USER';

export type GroupHealth = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EMPTY';

export interface GroupSummary {
  id: number;
  name: string;
  description?: string | null;
  kind: GroupKind;
  membershipMode: MembershipMode;
  color?: string | null;
  icon?: string | null;
  deviceCount: number;
  online: number;
  offline: number;
  devicesWithIssues: number;
  openIssues: number;
  health: GroupHealth;
  technicianCount: number;
  userCount: number;
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

/** What a group applies to its devices. */
export interface GroupPolicy {
  /** Days to keep logs; null means the platform default. */
  retentionDays: number | null;
  /** Fix keys the devices may use; null means every approved fix. */
  allowedScripts: string[] | null;
  /** New issues go to the least busy of the group's own technicians. */
  autoAssignIssues: boolean;
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
  kind?: GroupKind;
  membershipMode?: MembershipMode;
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
