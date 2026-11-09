import React from 'react';
import { Activity, ShieldAlert } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="font-bold text-xl tracking-tight text-white">FaultLab</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 font-mono">
              Phase 1
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span>Architecture: Monorepo</span>
          </div>
        </div>
      </div>
    </header>
  );
};

