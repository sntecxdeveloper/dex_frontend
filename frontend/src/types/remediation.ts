export interface Remediation {
  id: number;
  issueId: number;
  issueTitle?: string;
  action: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  result?: string;
  startedAt: string;
  completedAt?: string;
  initiatedBy?: string;
}

export interface RemediationSummary {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}
