import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type SlaPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Response and resolution targets, in minutes, for one ticket priority. */
export interface SlaPolicy {
  priority: SlaPriority;
  responseMinutes: number;
  resolutionMinutes: number;
}

export async function getSlaPolicies(): Promise<SlaPolicy[]> {
  const response = await api.get<ApiResponse<SlaPolicy[]>>('/itsm/sla-policies');
  return response.data.data;
}

export async function updateSlaPolicy(priority: SlaPriority, responseMinutes: number, resolutionMinutes: number): Promise<SlaPolicy> {
  const response = await api.put<ApiResponse<SlaPolicy>>(`/itsm/sla-policies/${priority}`, { responseMinutes, resolutionMinutes });
  return response.data.data;
}
