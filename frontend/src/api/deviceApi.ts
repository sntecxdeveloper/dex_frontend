import api from './axios';
import type { Device } from '../types';
import type { PagedResult } from '../types/paged';
import { downloadFile } from '../utils/download';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AgentHealth {
  agentId: string;
  healthy: boolean;
  heartbeatRecent: boolean;
  telemetryRecent: boolean;
  lastHeartbeat: string | null;
  lastTelemetryAt: string | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  diskUsage: number | null;
  message: string;
}

export interface HealthSummary {
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  openIssues: number;
  overallHealthy: boolean;
}

export async function getDevices(): Promise<Device[]> {
  const response = await api.get<ApiResponse<Device[]>>('/devices');
  return response.data.data;
}

export async function getDevicesPaged(params?: {
  page?: number;
  size?: number;
  status?: string;
  os?: string;
  q?: string;
}): Promise<PagedResult<Device>> {
  const response = await api.get<ApiResponse<PagedResult<Device>>>('/devices/paged', { params });
  return response.data.data;
}

export async function exportDevices(format: 'csv' | 'json'): Promise<void> {
  await downloadFile(`/export/devices?format=${format}`, `devices.${format}`);
}

export async function getDeviceById(id: number): Promise<Device> {
  const response = await api.get<ApiResponse<Device>>(`/devices/${id}`);
  return response.data.data;
}

export async function getDeviceByAgentId(agentId: string): Promise<Device> {
  const response = await api.get<ApiResponse<Device>>(`/devices/agent/${agentId}`);
  return response.data.data;
}

export async function deleteDevice(id: number): Promise<void> {
  await api.delete(`/devices/${id}`);
}

export async function deleteDevices(ids: number[]): Promise<void> {
  await api.delete('/devices', { params: { ids: ids.join(',') } });
}

export async function getDeletedDevices(): Promise<Device[]> {
  const response = await api.get<ApiResponse<Device[]>>('/devices/deleted');
  return response.data.data;
}

export async function restoreDevice(id: number): Promise<void> {
  await api.post(`/devices/${id}/restore`);
}

export async function restoreDevices(ids: number[]): Promise<void> {
  await api.post('/devices/restore', null, { params: { ids: ids.join(',') } });
}

export async function verifyAgentHealth(agentId: string): Promise<AgentHealth> {
  const response = await api.get<ApiResponse<AgentHealth>>(`/devices/agent/${agentId}/health`);
  return response.data.data;
}

export async function getHealthSummary(): Promise<HealthSummary> {
  const response = await api.get<ApiResponse<HealthSummary>>('/devices/health-summary');
  return response.data.data;
}
