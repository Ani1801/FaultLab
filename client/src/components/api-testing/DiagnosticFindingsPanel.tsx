import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Wifi,
  Lock,
  Settings,
  FileText,
  Network,
  Gauge,
  ClipboardList,
} from 'lucide-react';
import type { DiagnosticReport, DiagnosticFinding, DiagnosticSeverity, DiagnosticCategory } from '../../types/diagnostic';

interface DiagnosticFindingsPanelProps {
  diagnosticReport: DiagnosticReport | null | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeverityStyle(severity: DiagnosticSeverity): { badge: string; border: string; bg: string } {
  switch (severity) {
    case 'CRITICAL':
      return { badge: 'bg-rose-600 text-white', border: 'border-rose-500/40', bg: 'bg-rose-500/5' };
    case 'HIGH':
      return { badge: 'bg-rose-500/80 text-white', border: 'border-rose-500/30', bg: 'bg-rose-500/5' };
    case 'MEDIUM':
      return { badge: 'bg-amber-500/80 text-white', border: 'border-amber-500/30', bg: 'bg-amber-500/5' };
    case 'LOW':
      return { badge: 'bg-blue-500/60 text-white', border: 'border-blue-500/30', bg: 'bg-blue-500/5' };
    case 'INFO':
    default:
      return { badge: 'bg-slate-600 text-slate-200', border: 'border-slate-700', bg: 'bg-slate-800/40' };
  }
}

function getCategoryIcon(category: DiagnosticCategory) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (category) {
    case 'HTTP_STATUS': return <FileText className={cls} />;
    case 'AUTHENTICATION': return <Lock className={cls} />;
    case 'REQUEST_CONFIG': return <Settings className={cls} />;
    case 'RESPONSE': return <ClipboardList className={cls} />;
    case 'NETWORK': return <Network className={cls} />;
    case 'PERFORMANCE': return <Gauge className={cls} />;
    case 'ASSERTION': return <Wifi className={cls} />;
    default: return <Info className={cls} />;
  }
}

function getCategoryLabel(category: DiagnosticCategory): string {
  const labels: Record<DiagnosticCategory, string> = {
    HTTP_STATUS: 'HTTP Status',
    AUTHENTICATION: 'Authentication',
    REQUEST_CONFIG: 'Request Config',
    RESPONSE: 'Response',
    NETWORK: 'Network',
    PERFORMANCE: 'Performance',
    ASSERTION: 'Assertion',
  };
  return labels[category] ?? category;
}

// ─── Individual Finding Card ──────────────────────────────────────────────────

const FindingCard: React.FC<{ finding: DiagnosticFinding }> = ({ finding }) => {
  const [expanded, setExpanded] = useState(false);
  const style = getSeverityStyle(finding.severity);

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      {/* Header Row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-3 flex items-start gap-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono shrink-0 ${style.badge}`}>
            {finding.severity}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            {getCategoryIcon(finding.category)}
            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
              {getCategoryLabel(finding.category)}
            </span>
          </div>
          <span className="text-xs font-semibold text-white truncate">{finding.title}</span>
        </div>
        <div className="shrink-0 text-slate-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-800/60 pt-3">
          {/* Code + confidence */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span className="bg-slate-800 px-1.5 py-0.5 rounded">{finding.code}</span>
            <span>•</span>
            <span>Confidence: {finding.confidence}</span>
          </div>

          {/* Explanation */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">What Happened</p>
            <p className="text-xs text-slate-300 leading-relaxed">{finding.explanation}</p>
          </div>

          {/* Evidence */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Evidence</p>
            <p className="text-xs font-mono text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 leading-relaxed break-all">
              {finding.evidence}
            </p>
          </div>

          {/* Probable Cause */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Probable Cause</p>
            <p className="text-xs text-slate-300 leading-relaxed">{finding.probableCause}</p>
          </div>

          {/* Recommended Actions */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Recommended Actions</p>
            <ul className="space-y-1">
              {finding.recommendedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Overall Status Banner ────────────────────────────────────────────────────

const StatusBanner: React.FC<{ report: DiagnosticReport }> = ({ report }) => {
  if (report.overallStatus === 'HEALTHY') {
    return (
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-emerald-300">No Issues Detected</p>
          <p className="text-[11px] text-emerald-400/70">{report.summary}</p>
        </div>
      </div>
    );
  }

  if (report.overallStatus === 'WARNING') {
    return (
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-300">Potential Issues Detected</p>
          <p className="text-[11px] text-amber-400/70">{report.summary}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5">
      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-rose-300">Critical Issues Detected</p>
        <p className="text-[11px] text-rose-400/70">{report.summary}</p>
      </div>
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const DiagnosticFindingsPanel: React.FC<DiagnosticFindingsPanelProps> = ({ diagnosticReport }) => {
  if (!diagnosticReport) {
    return (
      <div className="py-6 text-center text-slate-500">
        <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-slate-700" />
        <p className="text-xs">No diagnostic report available for this run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StatusBanner report={diagnosticReport} />

      {diagnosticReport.findings.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">
            {diagnosticReport.totalFindings} Finding{diagnosticReport.totalFindings !== 1 ? 's' : ''}
            {' '}— click to expand
          </p>
          {diagnosticReport.findings.map((finding) => (
            <FindingCard key={finding.code} finding={finding} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic text-center py-2">
          No specific findings — the request completed within normal parameters.
        </p>
      )}
    </div>
  );
};

