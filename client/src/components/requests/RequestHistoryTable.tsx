import React from 'react';
import type { RequestLog, ListRequestLogsParams } from '../../types/requestLog';

interface RequestHistoryTableProps {
  logs: RequestLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filterParams: ListRequestLogsParams;
  onFilterChange: (newParams: Partial<ListRequestLogsParams>) => void;
  onPageChange: (newPage: number) => void;
  onSelectLog: (log: RequestLog) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const RequestHistoryTable: React.FC<RequestHistoryTableProps> = ({
  logs,
  pagination,
  filterParams,
  onFilterChange,
  onPageChange,
  onSelectLog,
  onRefresh,
  isLoading,
}) => {
  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'POST':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PUT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'PATCH':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusBadgeClass = (status: number, isFault: boolean) => {
    if (isFault) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    if (status >= 200 && status < 300) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (status >= 300 && status < 400) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    }
    if (status >= 400 && status < 500) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Table Filter Toolbar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search request path..."
              value={filterParams.search || ''}
              onChange={(e) => onFilterChange({ search: e.target.value || undefined, page: 1 })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-2.5 top-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Method Filter */}
          <select
            value={filterParams.method || ''}
            onChange={(e) => onFilterChange({ method: e.target.value || undefined, page: 1 })}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          {/* Fault Injected Filter */}
          <select
            value={
              filterParams.faultInjected === undefined
                ? ''
                : filterParams.faultInjected
                ? 'true'
                : 'false'
            }
            onChange={(e) => {
              const val = e.target.value;
              onFilterChange({
                faultInjected: val === '' ? undefined : val === 'true',
                page: 1,
              });
            }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Traffic</option>
            <option value="true">Faults Only</option>
            <option value="false">Normal Only</option>
          </select>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition border border-slate-700/60 disabled:opacity-50"
        >
          <svg
            className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/40 text-slate-400 uppercase tracking-wider font-medium border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Path</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Latency</th>
              <th className="py-3 px-4 hidden md:table-cell">Size (Req / Res)</th>
              <th className="py-3 px-4 hidden sm:table-cell">Timestamp</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="py-4 px-4">
                    <div className="h-4 bg-slate-800 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-medium">No request history found</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Send requests to your mock API endpoints to start recording logs.
                  </p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  className="hover:bg-slate-800/40 cursor-pointer transition"
                >
                  {/* Method */}
                  <td className="py-3 px-4 font-semibold">
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-mono ${getMethodBadgeClass(log.method)}`}>
                      {log.method}
                    </span>
                  </td>

                  {/* Path */}
                  <td className="py-3 px-4 font-mono text-slate-200 max-w-xs truncate">
                    {log.path}
                  </td>

                  {/* Status Code */}
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${getStatusBadgeClass(log.statusCode, log.isFaultInjected)}`}>
                      {log.isFaultInjected && (
                        <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      {log.statusCode}
                    </span>
                  </td>

                  {/* Latency */}
                  <td className="py-3 px-4 font-mono text-slate-300">
                    <span
                      className={
                        log.responseTime >= 500
                          ? 'text-rose-400 font-medium'
                          : log.responseTime >= 200
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }
                    >
                      {log.responseTime} ms
                    </span>
                  </td>

                  {/* Size */}
                  <td className="py-3 px-4 hidden md:table-cell text-slate-400 font-mono text-[11px]">
                    {formatSize(log.requestSize)} / {formatSize(log.responseSize)}
                  </td>

                  {/* Timestamp */}
                  <td className="py-3 px-4 hidden sm:table-cell text-slate-400 text-[11px]">
                    {new Date(log.createdAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing {logs.length} of {pagination.totalCount} requests (Page {pagination.page} of {pagination.totalPages})
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!pagination.hasPrevPage || isLoading}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasNextPage || isLoading}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

