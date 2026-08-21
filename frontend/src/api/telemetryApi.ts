import api from './axios';
import type { TelemetryData } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getTelemetryByDeviceId(deviceId: number): Promise<TelemetryData[]> {
  const response = await api.get<ApiResponse<TelemetryData[]>>(`/telemetry/device/${deviceId}`);
  return response.data.data;
}

export async function getLatestTelemetry(deviceId: number): Promise<TelemetryData> {
  const response = await api.get<ApiResponse<TelemetryData>>(`/telemetry/device/${deviceId}/latest`);
  return response.data.data;
}
