export type ServiceStatus = 'healthy' | 'degraded' | 'down';
export type DatabaseConnectionStatus = 'connected' | 'disconnected';

export interface DatabaseHealthInfo {
  status: DatabaseConnectionStatus;
  latencyMs: number | null;
  error: string | null;
}

export interface ServerHealthInfo {
  status: 'up';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
}

export interface HealthCheckResponse {
  status: ServiceStatus;
  server: ServerHealthInfo;
  database: DatabaseHealthInfo;
}

export interface HealthState {
  data: HealthCheckResponse | null;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

