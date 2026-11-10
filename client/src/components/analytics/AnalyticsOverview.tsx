import React from 'react';
import type { AnalyticsData } from '../../types/requestLog';

interface AnalyticsOverviewProps {
  analytics: AnalyticsData;
  isLoading?: boolean;
}

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({ analytics, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse h-28"
          />
        ))}
      </div>
    );
  }

  const successRateColor =
    analytics.successRate >= 95
      ? 'text-emerald-400'
      : analytics.successRate >= 80
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* 1. Total Requests */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Requests</p>
          <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
        </div>
        <p className="text-2xl font-bold text-white mt-2">
          {analytics.totalRequests.toLocaleString()}
        </p>
        <p className="text-xs text-slate-500 mt-1">Logged requests in window</p>
      </div>

      {/* 2. Success Rate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Success Rate</p>
          <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </div>
        <p className={`text-2xl font-bold mt-2 ${successRateColor}`}>
          {analytics.totalRequests > 0 ? `${analytics.successRate}%` : 'N/A'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {analytics.successfulRequests.toLocaleString()} 2xx/3xx responses
        </p>
      </div>

      {/* 3. Failures */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Failures</p>
          <span className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
        </div>
        <p className="text-2xl font-bold text-white mt-2">
          {analytics.failedRequests.toLocaleString()}
        </p>
        <p className="text-xs text-slate-500 mt-1">4xx & 5xx error responses</p>
      </div>

      {/* 4. Injected Faults */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Injected Faults</p>
          <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
        </div>
        <p className="text-2xl font-bold text-amber-400 mt-2">
          {analytics.faultInjectedRequests.toLocaleString()}
        </p>
        <p className="text-xs text-slate-500 mt-1">Chaos simulation events</p>
      </div>

      {/* 5. Latency */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Latency</p>
          <span className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </div>
        <p className="text-2xl font-bold text-white mt-2">
          {analytics.avgResponseTime}
          <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Min {analytics.minResponseTime}ms / Max {analytics.maxResponseTime}ms
        </p>
      </div>
    </div>
  );
};

