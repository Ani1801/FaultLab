import React, { useState } from 'react';
import type { ApiTestRun } from '../../types/apiTesting';
import type { DiagnosticReport } from '../../types/diagnostic';
import { DiagnosticFindingsPanel } from './DiagnosticFindingsPanel';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Code,
  Layers,
  CheckCircle2,
  Clock,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';

interface ResponseViewerProps {
  run: ApiTestRun | null;
  isLoading?: boolean;
  diagnosticReport?: DiagnosticReport | null;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ run, isLoading, diagnosticReport }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'assertions' | 'headers' | 'diagnostics'>('body');
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        <p className="text-xs font-mono text-slate-400">Executing request & evaluating assertions...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-2 text-slate-500">
        <p className="text-sm font-medium text-slate-400">No Response Yet</p>
        <p className="text-xs text-slate-600 max-w-sm">
          Enter an API URL above and click Send to inspect actual responses, headers, and automated test assertion results.
        </p>
      </div>
    );
  }

  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getStatusBadge = (code: number | null) => {
    if (code === null) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    if (code >= 200 && code < 300) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (code >= 300 && code < 400) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    if (code >= 400 && code < 500) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  };

  const handleCopyBody = async () => {
    if (!run.sanitizedResponseBody) return;
    try {
      await navigator.clipboard.writeText(run.sanitizedResponseBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const passedCount = run.assertionResults.filter((a) => a.passed).length;
  const totalAssertions = run.assertionResults.length;

  // Use prop if available, otherwise fall back to run.diagnosticReport
  const effectiveDiagnosticReport = diagnosticReport ?? run.diagnosticReport ?? null;
  const diagnosticFindingCount = effectiveDiagnosticReport?.totalFindings ?? 0;
  const diagnosticStatus = effectiveDiagnosticReport?.overallStatus;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Top Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {run.actualStatusCode !== null ? (
            <span
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${getStatusBadge(
                run.actualStatusCode
              )}`}
            >
              HTTP {run.actualStatusCode}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold border bg-rose-500/15 text-rose-400 border-rose-500/30">
              NETWORK ERROR
            </span>
          )}

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{run.responseTime} ms</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatSize(run.responseSize)}</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          {new Date(run.executedAt).toLocaleTimeString()}
        </div>
      </div>

      {/* Overall Status Banner */}
      {run.status === 'PASSED' && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-300">
              Test Run PASSED
            </span>
          </div>
          {totalAssertions > 0 && (
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
              All {totalAssertions} assertions passed
            </span>
          )}
        </div>
      )}

      {run.status === 'FAILED' && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-300">
              Test Run FAILED
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
            {passedCount} of {totalAssertions} passed
          </span>
        </div>
      )}

      {run.status === 'ERROR' && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-300">
            <span className="font-semibold block">Execution Error</span>
            <span className="font-mono text-[11px] text-rose-400">
              {run.errorMessage || 'An unhandled execution error occurred while dispatching the request.'}
            </span>
          </div>
        </div>
      )}

      {/* Response Subtabs */}
      <div className="border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('body')}
            className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'body'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Response Body</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assertions')}
            className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'assertions'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Assertions ({totalAssertions})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'headers'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Headers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'diagnostics'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
            {diagnosticFindingCount > 0 && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
                  diagnosticStatus === 'CRITICAL_ISSUES'
                    ? 'bg-rose-500/80 text-white'
                    : diagnosticStatus === 'WARNING'
                    ? 'bg-amber-500/80 text-white'
                    : 'bg-slate-600 text-slate-200'
                }`}
              >
                {diagnosticFindingCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'body' && run.sanitizedResponseBody && (
          <button
            type="button"
            onClick={handleCopyBody}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 pb-1 font-mono transition"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Tab 1: Body */}
      {activeTab === 'body' && (
        <div>
          {run.sanitizedResponseBody ? (
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-96 leading-relaxed">
              {run.sanitizedResponseBody}
            </pre>
          ) : (
            <p className="text-xs text-slate-500 italic py-4">Response body is empty (e.g. 204 No Content).</p>
          )}
        </div>
      )}

      {/* Tab 2: Assertions Results */}
      {activeTab === 'assertions' && (
        <div className="space-y-2">
          {run.assertionResults.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4">No automated expectations were configured for this test.</p>
          ) : (
            run.assertionResults.map((assertion, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                  assertion.passed
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {assertion.passed ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-semibold text-white">{assertion.name}</span>
                  </div>
                  {assertion.message && (
                    <p className="text-slate-400 pl-6 text-[11px]">{assertion.message}</p>
                  )}
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    assertion.passed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {assertion.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Headers */}
      {activeTab === 'headers' && (
        <div className="overflow-x-auto">
          {Object.keys(run.responseHeaders || {}).length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4">No response headers available.</p>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Header</th>
                  <th className="py-2 px-3">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-slate-300 text-[11px]">
                {Object.entries(run.responseHeaders).map(([k, v]) => (
                  <tr key={k} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 font-semibold text-indigo-300">{k}</td>
                    <td className="py-2 px-3 break-all text-slate-300">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 4: Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div className="pt-1">
          <DiagnosticFindingsPanel diagnosticReport={effectiveDiagnosticReport} />
        </div>
      )}
    </div>
  );
};

