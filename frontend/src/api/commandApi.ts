import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AgentCommand {
  id: number;
  commandId: string;
  agentId: string;
  type: string;
  action: string;
  parameters?: string;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  result?: string;
  createdAt: string;
  executedAt?: string;
}

export interface QueueCommandRequest {
  type: string;
  action: string;
  parameters?: string;
}

// Queue a command for an agent
export async function queueCommand(agentId: string, request: QueueCommandRequest): Promise<AgentCommand> {
  const response = await api.post<ApiResponse<AgentCommand>>(`/agent/${agentId}/commands`, request);
  return response.data.data;
}

// Get pending commands for an agent
export async function getPendingCommands(agentId: string): Promise<AgentCommand[]> {
  const response = await api.get<ApiResponse<AgentCommand[]>>(`/agent/${agentId}/commands`);
  return response.data.data;
}

// Report command result
export async function reportCommandResult(
  agentId: string,
  commandId: string,
  success: boolean,
  output?: string
): Promise<void> {
  await api.post(`/agent/${agentId}/command-result`, {
    commandId,
    success,
    output
  });
}

// Get agent health
export async function getAgentHealth(agentId: string): Promise<Record<string, unknown>> {
  const response = await api.get<ApiResponse<Record<string, unknown>>>(`/devices/agent/${agentId}/health`);
  return response.data.data;
}

// Get health summary
export async function getHealthSummary(): Promise<{
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  openIssues: number;
  overallHealthy: boolean;
}> {
  const response = await api.get<ApiResponse<{
    totalAgents: number;
    onlineAgents: number;
    offlineAgents: number;
    openIssues: number;
    overallHealthy: boolean;
  }>>('/devices/health-summary');
  return response.data.data;
}
