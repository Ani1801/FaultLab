import React from 'react';
import {
  Server,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Radio,
} from 'lucide-react';
import type { HealthState } from '../types/health';

interface HealthStatusCardProps {
  health: HealthState;
  onRefresh: () => void;
}

export const HealthStatusCard: React.FC<HealthStatusCardProps> = ({ health, onRefresh }) => {
  const { data, isLoading, error, lastChecked } = health;

  const isServerUp = Boolean(data && data.server?.status === 'up');
  const isDbConnected = Boolean(data && data.database?.status === 'connected');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800/80 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 text-sky-400">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">System Diagnostics & Health</h3>
            <p className="text-xs text-slate-400">Real-time status of backend service and PostgreSQL database</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          {lastChecked && (
            <span className="text-xs text-slate-400 flex items-center space-x-1 font-mono">
              <Clock className="h-3.5 w-3.5" />
              <span>{lastChecked.toLocaleTimeString()}</span>
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 hover:border-slate-600 transition-colors disabled:opacity-50"
            title="Refresh Health Status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isLoading ? 'Checking...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {/* Backend API Server Card */}
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-md bg-slate-850 text-slate-300">
                <Server className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200">Express Backend API</div>
                <div className="text-xs text-slate-400 font-mono">GET /api/v1/health</div>
              </div>
            </div>

            {error && !isServerUp ? (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800 font-medium">
                <XCircle className="h-3.5 w-3.5" />
                <span>Offline</span>
              </span>
            ) : isServerUp ? (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Operational</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Connecting...</span>
              </span>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Uptime: {data ? `${data.server.uptimeSeconds}s` : '--'}</span>
            <span>Env: {data ? data.server.environment : '--'}</span>
          </div>
        </div>

        {/* PostgreSQL Database Card */}
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-md bg-slate-850 text-slate-300">
                <Database className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200">PostgreSQL (Prisma)</div>
                <div className="text-xs text-slate-400 font-mono">Raw Query Ping: SELECT 1</div>
              </div>
            </div>

            {isDbConnected ? (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Connected</span>
              </span>
            ) : data && !isDbConnected ? (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Disconnected</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>Pending</span>
              </span>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Latency: {data?.database.latencyMs !== null && data?.database.latencyMs !== undefined ? `${data.database.latencyMs}ms` : '--'}
            </span>
            <span className={isDbConnected ? 'text-emerald-400' : 'text-amber-400'}>
              {isDbConnected ? 'Ready for Queries' : 'Requires Database Setup'}
            </span>
          </div>
        </div>
      </div>

      {/* Database Diagnostic Details Alert */}
      {data && !isDbConnected && (
        <div className="mt-4 p-3.5 rounded-lg bg-amber-950/30 border border-amber-900/50 flex items-start space-x-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <span className="font-semibold text-amber-300">Database Connection Notice: </span>
            The Express backend is live, but PostgreSQL is not currently reachable at the configured DATABASE_URL.
            {data.database.error && (
              <p className="mt-1 font-mono text-[11px] text-amber-400/80 bg-slate-950/60 p-2 rounded border border-amber-900/40 overflow-x-auto">
                {data.database.error}
              </p>
            )}
            <p className="mt-1.5 text-slate-400">
              Ensure PostgreSQL (local or Neon) is reachable and run migrations with <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded font-mono">npm run prisma:migrate</code>.
            </p>
          </div>
        </div>
      )}

      {/* Network / Connection Error Alert */}
      {error && !data && (
        <div className="mt-4 p-3.5 rounded-lg bg-rose-950/30 border border-rose-900/50 flex items-start space-x-3">
          <XCircle className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-rose-200/90">
            <span className="font-semibold text-rose-300">Backend Unreachable: </span>
            {error}. Verify that the backend server is running on port 5000.
          </div>
        </div>
      )}
    </div>
  );
};

