import React from 'react';
import { FolderGit2, Plus, Lock, Layers, Zap } from 'lucide-react';

export const ProjectPlaceholder: React.FC = () => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-semibold text-white">Workspaces & Simulated Projects</h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Phase 1 Preview
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage simulated services, chaos injection policies, and API failure mocks
          </p>
        </div>

        <button
          disabled
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-sky-600/30 text-sky-300 text-xs font-medium border border-sky-600/40 cursor-not-allowed opacity-75"
          title="Project management activates in Phase 2"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>New Workspace</span>
        </button>
      </div>

      {/* Empty State / Schema Preview */}
      <div className="mt-8 mb-4 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
        <div className="p-3.5 rounded-2xl bg-slate-850/80 border border-slate-800 text-slate-400 mb-4 shadow-inner">
          <FolderGit2 className="h-8 w-8 text-sky-400/80" />
        </div>
        <h4 className="text-sm font-semibold text-slate-200">No Projects Configured Yet</h4>
        <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
          The foundational Prisma database models for <code className="text-sky-300 font-mono">User</code> and{' '}
          <code className="text-sky-300 font-mono">Workspace</code> are prepared. Full project creation and chaos orchestration will be enabled in upcoming phases.
        </p>

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-6 text-left">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
            <div className="flex items-center space-x-2 text-sky-400 text-xs font-semibold mb-1">
              <Layers className="h-4 w-4" />
              <span>Multi-Tenant Workspaces</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Scoped environments with owner relationships configured in Prisma.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold mb-1">
              <Zap className="h-4 w-4" />
              <span>Fault Injection Rules</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Programmable latency, jitter, HTTP status overrides, and payload corruption.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold mb-1">
              <Plus className="h-4 w-4" />
              <span>Dynamic Endpoints</span>
            </div>
            <p className="text-[11px] text-slate-400">
              High-throughput mock endpoints with fine-grained failure configurations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

