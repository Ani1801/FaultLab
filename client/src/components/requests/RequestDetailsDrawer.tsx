import React from 'react';
import type { RequestLog } from '../../types/requestLog';

interface RequestDetailsDrawerProps {
  log: RequestLog | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RequestDetailsDrawer: React.FC<RequestDetailsDrawerProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !log) return null;

  const isSuccess = log.statusCode >= 200 && log.statusCode < 400;

  const statusBg = log.isFaultInjected
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : isSuccess
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  const methodColor =
    log.method === 'GET'
      ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
      : log.method === 'POST'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : log.method === 'PUT'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : log.method === 'PATCH'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      {/* Drawer Container */}
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded border ${methodColor}`}>
              {log.method}
            </span>
            <span className={`px-2.5 py-1 text-xs font-semibold rounded border ${statusBg}`}>
              HTTP {log.statusCode}
            </span>
            {log.isFaultInjected && (
              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Injected Fault
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Path banner */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-400 mb-1">Request Path</p>
            <div className="flex items-center justify-between font-mono text-sm text-slate-200 break-all">
              <span>{log.path}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(log.path)}
                className="ml-2 p-1 text-slate-400 hover:text-white text-xs hover:bg-slate-800 rounded transition"
                title="Copy Path"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Performance & Latency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Response Time</p>
              <p className="text-lg font-bold text-white mt-1">
                {log.responseTime} <span className="text-xs font-normal text-slate-400">ms</span>
              </p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Request Size</p>
              <p className="text-lg font-bold text-white mt-1">
                {log.requestSize !== null ? `${log.requestSize} B` : '0 B'}
              </p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Response Size</p>
              <p className="text-lg font-bold text-white mt-1">
                {log.responseSize !== null ? `${log.responseSize} B` : '0 B'}
              </p>
            </div>
          </div>

          {/* Associated Endpoint */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-300 mb-2">Simulated Endpoint Association</p>
            {log.endpoint ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Endpoint Name:</span>
                  <span className="text-white font-medium">{log.endpoint.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Route Pattern:</span>
                  <span className="font-mono text-indigo-400">{log.endpoint.method} {log.endpoint.path}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Endpoint ID:</span>
                  <span className="font-mono text-slate-500">{log.endpoint.id}</span>
                </div>
              </div>
            ) : log.wasMatched ? (
              <p className="text-xs text-slate-400">
                Endpoint was deleted (historical log preserved)
              </p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Unmatched request: No configured mock route matched this URL path and method.</span>
              </div>
            )}
          </div>

          {/* Metadata Section */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-300 mb-3">Request Metadata</p>
            <dl className="grid grid-cols-1 gap-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <dt className="text-slate-400">Log ID</dt>
                <dd className="font-mono text-slate-300 flex items-center gap-1">
                  <span>{log.id}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(log.id)}
                    className="text-slate-500 hover:text-white"
                    title="Copy Log ID"
                  >
                    📋
                  </button>
                </dd>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <dt className="text-slate-400">Timestamp</dt>
                <dd className="text-slate-300">
                  {new Date(log.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                </dd>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <dt className="text-slate-400">Project ID</dt>
                <dd className="font-mono text-slate-500">{log.projectId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Fault Simulation</dt>
                <dd className={log.isFaultInjected ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                  {log.isFaultInjected ? 'Active (Fault Injected)' : 'Disabled / Normal execution'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
