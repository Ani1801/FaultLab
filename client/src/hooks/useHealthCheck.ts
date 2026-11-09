import { useState, useEffect, useCallback } from 'react';
import { healthService } from '../services/healthService';
import type { HealthCheckResponse, HealthState } from '../types/health';

export const useHealthCheck = (pollIntervalMs = 15000) => {
  const [state, setState] = useState<HealthState>({
    data: null,
    isLoading: true,
    error: null,
    lastChecked: null,
  });

  const checkHealth = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data: HealthCheckResponse = await healthService.getHealth();
      setState({
        data,
        isLoading: false,
        error: null,
        lastChecked: new Date(),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to communicate with FaultLab backend API';
      setState((prev) => ({
        data: prev.data,
        isLoading: false,
        error: errorMessage,
        lastChecked: new Date(),
      }));
    }
  }, []);

  useEffect(() => {
    checkHealth();

    if (pollIntervalMs > 0) {
      const interval = setInterval(checkHealth, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [checkHealth, pollIntervalMs]);

  return {
    ...state,
    refetch: checkHealth,
  };
};

