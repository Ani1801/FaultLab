import React from 'react';
import { ShieldCheck, Activity, Terminal, ArrowUpRight } from 'lucide-react';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { HealthStatusCard } from '../components/HealthStatusCard';
import { ProjectPlaceholder } from '../components/ProjectPlaceholder';

export const HomePage: React.FC = () => {
  const health = useHealthCheck(15000);

  return (
    <div className="space-y-8">
      {/* Hero / Welcome Section */}
      <section className="relative rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-10 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-950/70 border border-sky-800/80 text-sky-400 text-xs font-mono mb-4">
            <Activity className="h-3.5 w-3.5" />
            <span>Phase 1: Foundations & Architecture Complete</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Scalable API Simulation & <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Failure-Testing</span> Platform
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Welcome to <strong className="text-white font-semibold">FaultLab</strong>. Engineer resilient distributed applications by simulating complex failure modes, high latency, network timeouts, and HTTP status code anomalies before production deployment.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Modular Monorepo</span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <Terminal className="h-4 w-4 text-sky-400" />
              <span>TypeScript Strict Mode</span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <ArrowUpRight className="h-4 w-4 text-indigo-400" />
              <span>Prisma ORM + PostgreSQL</span>
            </div>
          </div>
        </div>
      </section>

      {/* Backend & Database Connection Diagnostics */}
      <section>
        <HealthStatusCard health={health} onRefresh={health.refetch} />
      </section>

      {/* Projects / Workspaces Section Placeholder */}
      <section>
        <ProjectPlaceholder />
      </section>
    </div>
  );
};

