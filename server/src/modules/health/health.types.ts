export type ServiceStatus = 'healthy' | 'degraded' | 'down';
export type DatabaseConnectionStatus = 'connected' | 'disconnected';

export interface DatabaseHealthInfo {
  status: DatabaseConnectionStatus;
  latencyMs: number | null;
  error: string | null;
}

export interface HealthCheckResponse {
  status: ServiceStatus;
  server: {
    status: 'up';
    uptimeSeconds: number;
    timestamp: string;
    environment: string;
  };
  database: DatabaseHealthInfo;
}

