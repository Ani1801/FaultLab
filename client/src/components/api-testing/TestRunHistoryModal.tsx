import React, { useState, useEffect } from 'react';
import type { ApiTest, ApiTestRun } from '../../types/apiTesting';
import { apiTestingService } from '../../services/apiTestingService';
import {
  X,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';

interface TestRunHistoryModalProps {
  test: ApiTest;
  onClose: () => void;
}

export const TestRunHistoryModal: React.FC<TestRunHistoryModalProps> = ({
  test,
  onClose,
}) => {
  const [runs, setRuns] = useState<ApiTestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);

  const fetchRuns = async (pageNum: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiTestingService.listTestRuns(test.id, pageNum, 10);
      setRuns(res.runs);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.totalCount ?? res.pagination.total ?? res.runs.length);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load test runs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns(page);
  }, [test.id, page]);

  const toggleExpand = (runId: string) => {
    setExpandedRunId(expandedRunId === runId ? null : runId);
  };

  const handleCopyBody = (runId: string, body: string) => {
    navigator.clipboard.writeText(body);
    setCopiedRunId(runId);
    setTimeout(() => setCopiedRunId(null), 2000);
  };

  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                <span>Execution History:</span>
                <span className="text-indigo-400 font-mono">{test.name}</span>
              </h2>
              <p className="text-xs text-slate-500">
                {totalCount} total executions recorded • URL: {test.url}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto" />
              <p className="text-xs text-slate-400 font-mono">Loading execution records...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          ) : runs.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-slate-500">
              <History className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-medium text-slate-400">No Executions Found</p>
              <p className="text-xs text-slate-600">
                This test has not been executed yet. Click "Run" to test your API endpoint.
              </p>
            </div>
          ) : (
            runs.map((run) => {
              const isExpanded = expandedRunId === run.id;
              const assertionsPassed = run.assertionResults.filter((a) => a.passed).length;
              const totalAssertions = run.assertionResults.length;

              return (
                <div
                  key={run.id}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl transition overflow-hidden"
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => toggleExpand(run.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition select-none"
                  >
                    <div className="flex items-center space-x-3">
                      {/* Status Badge */}
                      {run.status === 'PASSED' ? (
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>PASS</span>
                        </div>
                      ) : run.status === 'FAILED' ? (
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                          <XCircle className="w-4 h-4" />
                          <span>FAIL</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                          <AlertTriangle className="w-4 h-4" />
                          <span>ERROR</span>
                        </div>
                      )}

                      {/* Status Code & Latency */}
                      <div className="flex items-center space-x-3 text-xs text-slate-300 font-mono">
                        {run.actualStatusCode && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              run.actualStatusCode >= 200 && run.actualStatusCode < 300
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : run.actualStatusCode >= 400 && run.actualStatusCode < 500
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            HTTP {run.actualStatusCode}
                          </span>
                        )}
                        <span className="flex items-center space-x-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{run.responseTime} ms</span>
                        </span>
                        <span className="flex items-center space-x-1 text-slate-400">
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>{formatSize(run.responseSize)}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Assertions Result */}
                      {totalAssertions > 0 && (
                        <div className="text-xs font-medium">
                          <span
                            className={
                              assertionsPassed === totalAssertions
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {assertionsPassed}/{totalAssertions} assertions passed
                          </span>
                        </div>
                      )}

                      {/* Executed At */}
                      <span className="text-xs text-slate-500">
                        {new Date(run.executedAt).toLocaleString()}
                      </span>

                      {/* Toggle Icon */}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 bg-slate-900/40 space-y-4">
                      {/* Error Message if present */}
                      {run.errorMessage && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                          <strong>Error: </strong> {run.errorMessage}
                        </div>
                      )}

                      {/* Assertion Details */}
                      {run.assertionResults.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            Assertion Evaluations
                          </h4>
                          <div className="space-y-1.5">
                            {run.assertionResults.map((a, idx) => (
                              <div
                                key={idx}
                                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between ${
                                  a.passed
                                    ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-300'
                                    : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="font-semibold flex items-center space-x-1.5">
                                    {a.passed ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                    )}
                                    <span>{a.name}</span>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-400 pl-5">
                                    Expected: {JSON.stringify(a.expected)} | Actual:{' '}
                                    {JSON.stringify(a.actual)}
                                  </div>
                                  {a.message && !a.passed && (
                                    <div className="text-[11px] text-rose-400 pl-5">
                                      {a.message}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                    a.passed
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {a.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Response Headers */}
                      {run.responseHeaders && Object.keys(run.responseHeaders).length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            Response Headers
                          </h4>
                          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800/80 max-h-36 overflow-y-auto space-y-1">
                            {Object.entries(run.responseHeaders).map(([k, v]) => (
                              <div
                                key={k}
                                className="text-[11px] font-mono flex items-start space-x-2"
                              >
                                <span className="text-slate-400 font-semibold">{k}:</span>
                                <span className="text-slate-200 break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Response Body */}
                      {run.sanitizedResponseBody && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                              Response Body
                            </h4>
                            <button
                              onClick={() =>
                                handleCopyBody(run.id, run.sanitizedResponseBody || '')
                              }
                              className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-xs transition"
                            >
                              {copiedRunId === run.id ? (
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
                          </div>
                          <pre className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 whitespace-pre">
                            {(() => {
                              try {
                                return JSON.stringify(
                                  JSON.parse(run.sanitizedResponseBody),
                                  null,
                                  2
                                );
                              } catch {
                                return run.sanitizedResponseBody;
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

