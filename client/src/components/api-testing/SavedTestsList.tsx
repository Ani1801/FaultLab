import React, { useState } from 'react';
import type { ApiTest, HttpMethod } from '../../types/apiTesting';
import {
  Play,
  History,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface SavedTestsListProps {
  tests: ApiTest[];
  activeTestId: string | null;
  onSelectTest: (test: ApiTest) => void;
  onRunTest: (test: ApiTest) => void;
  onViewHistory: (test: ApiTest) => void;
  onDeleteTest: (test: ApiTest) => void;
  onNewTest: () => void;
  runningTestId?: string | null;
  isLoading?: boolean;
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  POST: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  DELETE: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export const SavedTestsList: React.FC<SavedTestsListProps> = ({
  tests,
  activeTestId,
  onSelectTest,
  onRunTest,
  onViewHistory,
  onDeleteTest,
  onNewTest,
  runningTestId,
  isLoading,
}) => {
  const [search, setSearch] = useState('');

  const filteredTests = tests.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.url.toLowerCase().includes(search.toLowerCase()) ||
      t.method.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Saved API Tests</h3>
          <p className="text-xs text-slate-500">
            {tests.length} {tests.length === 1 ? 'test suite' : 'test suites'} configured
          </p>
        </div>
        <button
          onClick={onNewTest}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Test</span>
        </button>
      </div>

      {/* Search Filter */}
      {tests.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved tests..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Test List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[600px]">
        {isLoading && tests.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto mb-2" />
            Loading test configurations...
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <p>
              {tests.length === 0
                ? 'No saved tests yet.'
                : 'No tests match your search filter.'}
            </p>
            {tests.length === 0 && (
              <p className="text-slate-600 text-[11px]">
                Configure request parameters and click "Save Test" to persist test scenarios.
              </p>
            )}
          </div>
        ) : (
          filteredTests.map((test) => {
            const isSelected = activeTestId === test.id;
            const isRunning = runningTestId === test.id;

            return (
              <div
                key={test.id}
                onClick={() => onSelectTest(test)}
                className={`group cursor-pointer rounded-xl p-3 border transition flex flex-col space-y-2 ${
                  isSelected
                    ? 'bg-slate-800/80 border-indigo-500/50 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/30'
                }`}
              >
                {/* Top Row: Method, Name, and Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        methodColors[test.method]
                      }`}
                    >
                      {test.method}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {test.name}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  {test.lastRun ? (
                    <div className="flex items-center space-x-1">
                      {test.lastRun.status === 'PASSED' ? (
                        <span className="flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>PASS</span>
                        </span>
                      ) : test.lastRun.status === 'FAILED' ? (
                        <span className="flex items-center space-x-1 text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 font-medium">
                          <XCircle className="w-3 h-3" />
                          <span>FAIL</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span>ERR</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">Untested</span>
                  )}
                </div>

                {/* Middle Row: URL */}
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  {test.url}
                </div>

                {/* Bottom Row: Metadata & Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/50 text-[10px] text-slate-500">
                  <div className="flex items-center space-x-2">
                    {test.lastRun && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{test.lastRun.responseTime}ms</span>
                        {test.lastRun.actualStatusCode && (
                          <span className="text-slate-400">({test.lastRun.actualStatusCode})</span>
                        )}
                      </span>
                    )}
                    {test.expectedResponse && test.expectedResponse.length > 0 && (
                      <span>{test.expectedResponse.length} assertions</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onRunTest(test)}
                      disabled={isRunning}
                      title="Run Test"
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition"
                    >
                      {isRunning ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-emerald-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => onViewHistory(test)}
                      title="View Run History"
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTest(test)}
                      title="Delete Test"
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

