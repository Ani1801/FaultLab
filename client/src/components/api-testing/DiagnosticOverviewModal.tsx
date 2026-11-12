import React, { useState, useEffect } from 'react';
import type { DiagnosticListItem, DiagnosticSummary, DiagnosticOverallStatus, DiagnosticReport } from '../../types/diagnostic';
import { diagnosticService } from '../../services/diagnosticService';
import { DiagnosticFindingsPanel } from './DiagnosticFindingsPanel';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Activity,
  Layers,
} from 'lucide-react';

interface DiagnosticOverviewModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export const DiagnosticOverviewModal: React.FC<DiagnosticOverviewModalProps> = ({
  projectId,
  projectName,
  onClose,
}) => {
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [reports, setReports] = useState<DiagnosticListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DiagnosticOverallStatus>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Expanded report state for viewing full findings
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedReportData, setExpandedReportData] = useState<Record<string, DiagnosticReport>>({});
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      const data = await diagnosticService.getProjectDiagnosticSummary(projectId);
      setSummary(data);
    } catch {
      // Non-fatal, summary can be empty
    }
  };

  const fetchReports = async (pageNum: number, status: 'ALL' | DiagnosticOverallStatus) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await diagnosticService.listProjectDiagnostics(projectId, {
        page: pageNum,
        limit: 10,
        overallStatus: status === 'ALL' ? undefined : status,
      });
      setReports(res.diagnostics);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.totalCount || res.diagnostics.length);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load diagnostic reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [projectId]);

  useEffect(() => {
    fetchReports(page, statusFilter);
  }, [projectId, page, statusFilter]);

  const handleToggleExpand = async (item: DiagnosticListItem) => {
    if (expandedRunId === item.id) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(item.id);

    // If report details aren't cached and we have an apiTestRunId, fetch it
    if (!expandedReportData[item.id] && item.apiTestRunId) {
      setLoadingRunId(item.id);
      try {
        const fullReport = await diagnosticService.getDiagnosticByRunId(item.apiTestRunId);
        if (fullReport) {
          setExpandedReportData((prev) => ({ ...prev, [item.id]: fullReport }));
        }
      } catch {
        // Fall back to synthetic report from list item
      } finally {
        setLoadingRunId(null);
      }
    }
  };

  const getStatusBadge = (status: DiagnosticOverallStatus) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Healthy
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </span>
        );
      case 'CRITICAL_ISSUES':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            Critical
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                <span>Diagnostic Engine:</span>
                <span className="text-indigo-400 font-mono">{projectName}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Rule-based automated API troubleshooting, classification, and recommendations
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

        {/* Summary Metric Cards */}
        {summary && (
          <div className="px-6 py-3 border-b border-slate-800 grid grid-cols-4 gap-3 bg-slate-950/20">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-2.5 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Reports</span>
              <span className="text-lg font-bold text-slate-100 font-mono">{summary.total}</span>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5 text-center">
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">Healthy</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">{summary.healthy}</span>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5 text-center">
              <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">Warnings</span>
              <span className="text-lg font-bold text-amber-400 font-mono">{summary.warning}</span>
            </div>
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-2.5 text-center">
              <span className="text-[10px] text-rose-400 uppercase font-bold tracking-wider block">Critical</span>
              <span className="text-lg font-bold text-rose-400 font-mono">{summary.criticalIssues}</span>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-medium">Filter Status:</span>
            {(['ALL', 'HEALTHY', 'WARNING', 'CRITICAL_ISSUES'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'CRITICAL_ISSUES' ? 'Critical' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <span className="text-slate-500 text-xs font-mono">{totalCount} total results</span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              <p className="text-xs">Loading diagnostic history...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-700" />
              <p className="text-sm font-medium text-slate-400">No Diagnostic Reports Recorded</p>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Execute saved API tests with the Real API Testing engine to automatically generate diagnostic insights.
              </p>
            </div>
          ) : (
            reports.map((item) => {
              const isExpanded = expandedRunId === item.id;
              const fullData = expandedReportData[item.id];
              const isItemLoading = loadingRunId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700/80 transition"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(item)}
                    className="w-full text-left p-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusBadge(item.overallStatus as DiagnosticOverallStatus)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{item.summary}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-slate-400">
                            {item.totalFindings} finding{item.totalFindings !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-slate-500">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-slate-950/70">
                      {isItemLoading ? (
                        <div className="py-4 text-center text-xs text-slate-500">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto mb-2" />
                          Loading full report findings...
                        </div>
                      ) : fullData ? (
                        <DiagnosticFindingsPanel diagnosticReport={fullData} />
                      ) : (
                        <div className="py-2 text-xs text-slate-400">
                          <p className="font-medium text-slate-300">{item.summary}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Total findings: {item.totalFindings}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
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

