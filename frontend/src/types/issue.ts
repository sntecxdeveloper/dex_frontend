export interface Issue {
  id: number;
  title: string;
  description?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  deviceId?: number;
  deviceHostname?: string;
  assignedTo?: string;
  aiExplanation?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface IssueFilters {
  severity?: string;
  status?: string;
  search?: string;
}

export interface IssueSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}
