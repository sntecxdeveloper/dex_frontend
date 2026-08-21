import api from './axios';
import type { Device } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getDevices(): Promise<Device[]> {
  const response = await api.get<ApiResponse<Device[]>>('/devices');
  return response.data.data;
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
