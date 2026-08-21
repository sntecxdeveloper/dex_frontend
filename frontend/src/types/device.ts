export interface Device {
  id: number;
  agentId: string;
  hostname: string;
  ipAddress?: string;
  os?: string;
  osVersion?: string;
  agentVersion?: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'ENROLLING';
  enrolledAt?: string;
  lastHeartbeat?: string;
  createdAt?: string;
}

export interface AgentEnrollmentRequest {
  agentId: string;
  hostname: string;
  ipAddress?: string;
  os?: string;
  osVersion?: string;
  agentVersion?: string;
  enrollmentToken: string;
}

export interface AgentHeartbeatRequest {
  agentId: string;
  agentVersion?: string;
  ipAddress?: string;
}

export interface DeviceHealthSummary {
  total: number;
  online: number;
  offline: number;
  error: number;
}
