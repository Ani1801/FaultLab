import React, { useState } from 'react';
import {
  Copy,
  Check,
  Edit3,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  Code2,
  Sliders,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import type { MockEndpoint, HttpMethod } from '../../types/endpoint';

interface EndpointCardProps {
  endpoint: MockEndpoint;
  baseUrl: string;
  onEdit: (endpoint: MockEndpoint) => void;
  onDelete: (endpoint: MockEndpoint) => void;
}

const METHOD_STYLES: Record<HttpMethod, { bg: string; text: string; border: string }> = {
  GET: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  POST: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  PUT: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  PATCH: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  DELETE: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
};

const getStatusBadgeColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
  if (status >= 300 && status < 400) return 'text-sky-400 bg-sky-950/40 border-sky-800/60';
  if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
  return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
};

export const EndpointCard: React.FC<EndpointCardProps> = ({
  endpoint,
  baseUrl,
  onEdit,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fullUrl = `${baseUrl}${endpoint.path}`;
  const methodStyle = METHOD_STYLES[endpoint.method] || {
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-700',
  };

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formattedJson =
    endpoint.responseBody !== undefined && endpoint.responseBody !== null
      ? typeof endpoint.responseBody === 'string'
        ? endpoint.responseBody
        : JSON.stringify(endpoint.responseBody, null, 2)
      : 'null';

  const formattedFaultJson =
    endpoint.failureResponseBody !== undefined && endpoint.failureResponseBody !== null
      ? typeof endpoint.failureResponseBody === 'string'
        ? endpoint.failureResponseBody
        : JSON.stringify(endpoint.failureResponseBody, null, 2)
      : 'null';

  const totalDelay = endpoint.responseDelay + (endpoint.faultEnabled ? endpoint.additionalDelay : 0);

  return (
    <div className={`bg-slate-900/90 hover:bg-slate-900 border rounded-xl p-5 shadow-lg transition-all duration-200 flex flex-col group ${
      endpoint.faultEnabled ? 'border-amber-900/50 hover:border-amber-700/60' : 'border-slate-800 hover:border-slate-700/80'
    }`}>
      {/* Header Row: Method + Path + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3 overflow-hidden">
          {/* Method Badge */}
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider border ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border}`}
          >
            {endpoint.method}
          </span>

          {/* Path */}
          <span className="font-mono text-sm sm:text-base font-semibold text-slate-100 truncate">
            {endpoint.path}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 sm:self-center">
          <button
            onClick={handleCopyUrl}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center space-x-1"
            title={copied ? 'Copied Full URL!' : 'Copy endpoint URL'}
            aria-label="Copy mock URL"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="text-xs font-mono hidden sm:inline">
              {copied ? 'Copied' : 'Copy URL'}
            </span>
          </button>

          <button
            onClick={() => onEdit(endpoint)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Edit endpoint"
            aria-label={`Edit ${endpoint.name}`}
          >
            <Edit3 className="h-4 w-4" />
          </button>

          <button
            onClick={() => onDelete(endpoint)}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
            title="Delete endpoint"
            aria-label={`Delete ${endpoint.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Endpoint Name */}
      <div className="mt-2 text-xs text-slate-400 font-medium">
        {endpoint.name}
      </div>

      {/* Metadata Badges: Status Code, Delay, Fault info */}
      <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80 text-xs">
        {/* Normal Status Code */}
        <span
          className={`font-mono px-2 py-0.5 rounded border text-[11px] font-medium ${getStatusBadgeColor(
            endpoint.statusCode
          )}`}
        >
          HTTP {endpoint.statusCode}
        </span>

        {/* Latency: normal and additional */}
        <span className="inline-flex items-center space-x-1 text-slate-400 font-mono text-[11px] bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
          <Clock className="h-3 w-3 text-slate-500" />
          <span>{totalDelay}ms</span>
          {endpoint.faultEnabled && endpoint.additionalDelay > 0 && (
            <span className="text-amber-400 text-[10px]">
              ({endpoint.responseDelay} + {endpoint.additionalDelay}ms fault)
            </span>
          )}
        </span>

        {/* Phase 5 Fault Injection Badge */}
        {endpoint.faultEnabled ? (
          <span className="inline-flex items-center space-x-1.5 font-mono text-[11px] px-2 py-0.5 rounded border bg-amber-500/10 text-amber-300 border-amber-500/30">
            <Zap className="h-3 w-3 text-amber-400" />
            <span>
              {endpoint.failureMode === 'ALWAYS' && `Fault: ALWAYS (${endpoint.failureStatusCode})`}
              {endpoint.failureMode === 'RANDOM' && `Fault: RANDOM (${endpoint.failureRate}% → ${endpoint.failureStatusCode})`}
              {endpoint.failureMode === 'NONE' && 'Fault: Latency Only'}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 text-slate-500 font-mono text-[10px] bg-slate-950/40 px-1.5 py-0.5 rounded border border-slate-800/50">
            Fault: Disabled
          </span>
        )}

        {/* Custom Headers Count */}
        {endpoint.responseHeaders && Object.keys(endpoint.responseHeaders).length > 0 && (
          <span className="inline-flex items-center space-x-1 text-slate-400 font-mono text-[11px] bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
            <Sliders className="h-3 w-3 text-slate-500" />
            <span>{Object.keys(endpoint.responseHeaders).length} headers</span>
          </span>
        )}

        {/* Toggle Payload details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-auto inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Expanded Payload & Fault Details Panel */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 animate-fade-in">
          {/* Fault Configuration Summary if active */}
          {endpoint.faultEnabled && (
            <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300 flex items-center space-x-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span>Fault Injection Active</span>
                </span>
                <span className="font-mono text-[11px] text-amber-400">
                  Mode: {endpoint.failureMode}
                  {endpoint.failureMode === 'RANDOM' && ` (${endpoint.failureRate}%)`}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Injected Failure Response ({endpoint.failureStatusCode})
                </p>
                <pre className="bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-xs text-rose-300 overflow-x-auto max-h-36 leading-relaxed">
                  {formattedFaultJson}
                </pre>
              </div>
            </div>
          )}

          {/* Response Headers */}
          {endpoint.responseHeaders && Object.keys(endpoint.responseHeaders).length > 0 && (
            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Response Headers
              </p>
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-300 space-y-1">
                {Object.entries(endpoint.responseHeaders).map(([k, v]) => (
                  <div key={k} className="flex space-x-2">
                    <span className="text-indigo-400">{k}:</span>
                    <span className="text-slate-300 truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Normal Response Body */}
          <div>
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
              Normal Response Body (HTTP {endpoint.statusCode})
            </p>
            <pre className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300 overflow-x-auto max-h-48 leading-relaxed">
              {formattedJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
