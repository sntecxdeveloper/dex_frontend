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

// Queue a command for a device from the web UI (operator endpoint - audit-logged).
export async function queueDeviceCommand(deviceId: number, request: QueueCommandRequest): Promise<AgentCommand> {
  const response = await api.post<ApiResponse<AgentCommand>>(`/devices/${deviceId}/commands`, request);
  return response.data.data;
}

// Run a knowledge-base script on a device. The backend loads the script text itself;
// runAsAdmin makes the agent ask the user at that PC to approve Windows' admin prompt.
export async function runKbScript(deviceId: number, scriptId: number, runAsAdmin: boolean): Promise<AgentCommand> {
  const response = await api.post<ApiResponse<AgentCommand>>(`/devices/${deviceId}/kb-scripts/${scriptId}/run`, { runAsAdmin });
  return response.data.data;
}

// Recent commands for a device, newest first, with their real output once finished.
export async function getDeviceCommands(deviceId: number, limit = 50): Promise<AgentCommand[]> {
  const response = await api.get<ApiResponse<AgentCommand[]>>(`/devices/${deviceId}/commands`, { params: { limit } });
  return response.data.data;
}

export const isFinished = (status: AgentCommand['status']) => status === 'COMPLETED' || status === 'FAILED';

/**
 * Polls a queued command until the agent reports a result. The agent picks
 * commands up within ~5s, but anything that changes the machine first waits
 * for the user at that PC to approve it, so this can legitimately take a
 * while. Resolves with the last-seen command on timeout (still unfinished).
 */
export async function waitForCommandResult(
  deviceId: number,
  commandId: string,
  { timeoutMs = 5 * 60_000, intervalMs = 2_000, onUpdate, signal }: {
    timeoutMs?: number;
    intervalMs?: number;
    onUpdate?: (command: AgentCommand) => void;
    signal?: AbortSignal;
  } = {},
): Promise<AgentCommand | null> {
  const deadline = Date.now() + timeoutMs;
  let last: AgentCommand | null = null;
  while (Date.now() < deadline && !signal?.aborted) {
    const commands = await getDeviceCommands(deviceId, 50);
    const match = commands.find((c) => c.commandId === commandId);
    if (match) {
      last = match;
      onUpdate?.(match);
      if (isFinished(match.status)) return match;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return last;
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
