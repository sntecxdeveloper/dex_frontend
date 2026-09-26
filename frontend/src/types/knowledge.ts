export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  category?: string;
  tags?: string; // Backend returns comma-separated string
  author?: string;
  viewCount?: number;
  status?: string; // DRAFT | PUBLISHED | ARCHIVED
  approvalStatus?: string; // PENDING_REVIEW | APPROVED
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** DRAFT → PENDING_REVIEW → APPROVED (or REJECTED); an approved version is RETIRED once a newer one is approved. */
export type ScriptStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETIRED';
export type ScriptRisk = 'LOW' | 'MEDIUM' | 'HIGH';

/** One version of a governed KB fix script. */
export interface KnowledgeScript {
  id: number;
  articleId?: number | null;
  scriptKey: string;
  version: number;
  status: ScriptStatus;
  title: string;
  description?: string;
  language?: string;
  content: string;
  author?: string;
  requiresAdmin: boolean;
  riskLevel: ScriptRisk;
  timeoutSeconds: number;
  supportedOs?: string;
  /** JSON array of ScriptParameter definitions. */
  parametersSchema?: string | null;
  /** Comma-separated issue categories / title keywords this script fixes. */
  issueMatch?: string | null;
  autoRun: boolean;
  checkScript?: string | null;
  verifyScript?: string | null;
  undoScript?: string | null;
  contentHash?: string | null;
  signed: boolean;
  createdBy?: string;
  updatedBy?: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ScriptParameterType = 'string' | 'int' | 'bool' | 'choice';

/** A typed input the script declares with param(...). Values are passed as data, never pasted into the script. */
export interface ScriptParameter {
  name: string;
  label?: string;
  type: ScriptParameterType;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];
  pattern?: string;
  maxLength?: number;
  min?: number;
  max?: number;
}

/** FIXED, VERIFIED and NOT_NEEDED are successes; the rest need a look. */
export type KbRunStatus =
  | 'QUEUED'
  | 'FIXED'
  | 'VERIFIED'
  | 'NOT_NEEDED'
  | 'ROLLED_BACK'
  | 'VERIFY_FAILED'
  | 'FAILED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface KbScriptRun {
  id: number;
  scriptId?: number | null;
  scriptKey: string;
  scriptVersion: number;
  agentId: string;
  commandId?: string;
  issueId?: number | null;
  triggerType: 'MANUAL' | 'AUTO' | 'AGENT_LOCAL';
  requestedBy?: string;
  parameters?: string | null;
  status: KbRunStatus;
  output?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface DeviceKbSuggestion {
  issueId: number;
  issueCode: string;
  issueTitle: string;
  script: KnowledgeScript;
}

export interface KnowledgeScreenshot {
  id: number;
  articleId: number;
  caption?: string;
  imageData: string;
  createdAt: string;
}
