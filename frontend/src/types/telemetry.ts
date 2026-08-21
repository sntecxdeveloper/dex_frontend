export interface TelemetryData {
  id: number;
  deviceId: number;
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
}

export interface TelemetrySummary {
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  totalNetworkIn: number;
  totalNetworkOut: number;
}
