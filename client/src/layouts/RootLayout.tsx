import React from 'react';
import { Header } from '../components/Header';

export const RootLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-400">
        FaultLab © 2026 — Scalable API Simulation & Chaos Failure-Testing Platform • Phase 1 Architecture
      </footer>
    </div>
  );
};

