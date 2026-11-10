import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { workspaceService } from '../services/workspaceService';
import type { Workspace } from '../types/workspace';
import { WorkspaceCard } from '../components/workspaces/WorkspaceCard';
import { WorkspaceModal } from '../components/workspaces/WorkspaceModal';
import { DeleteConfirmModal } from '../components/workspaces/DeleteConfirmModal';
import {
  Shield,
  KeyRound,
  Calendar,
  FolderGit2,
  LogOut,
  CheckCircle2,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await workspaceService.listWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspaces';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleCreate = async (name: string) => {
    const newWs = await workspaceService.createWorkspace(name);
    setWorkspaces((prev) => [newWs, ...prev]);
  };

  const handleRename = async (name: string) => {
    if (!editingWorkspace) return;
    const updated = await workspaceService.renameWorkspace(editingWorkspace.id, name);
    setWorkspaces((prev) => prev.map((ws) => (ws.id === updated.id ? updated : ws)));
  };

  const handleDelete = async () => {
    if (!deletingWorkspace) return;
    await workspaceService.deleteWorkspace(deletingWorkspace.id);
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== deletingWorkspace.id));
  };

  if (!user) {
    return null;
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner: Authenticated Identity */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-sky-950 border border-sky-800/80 flex items-center justify-center text-sky-400 font-mono text-lg font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-white tracking-tight">{user.name}</h2>
              <span className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-mono">
                <CheckCircle2 className="h-3 w-3" />
                <span>Authenticated</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="inline-flex items-center justify-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Account & Security Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 text-sky-400">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Account ID</span>
            <p className="text-xs font-mono text-slate-200 mt-0.5 truncate max-w-[180px]">{user.id}</p>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 text-indigo-400">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Session Security</span>
            <p className="text-xs font-mono text-emerald-400 mt-0.5">HttpOnly Signed JWT</p>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 text-emerald-400">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Member Since</span>
            <p className="text-xs font-mono text-slate-200 mt-0.5">{memberSince}</p>
          </div>
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-white">Your Workspaces</h3>
              <span className="text-xs text-sky-400 font-mono bg-sky-950/80 border border-sky-800/60 px-2 py-0.5 rounded-full">
                {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Isolated simulation and failure-testing environments under your account
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={fetchWorkspaces}
              disabled={isLoading}
              title="Refresh workspaces"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-lg shadow-sky-600/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Workspace</span>
            </button>
          </div>
        </div>

        {/* Content area: Loading / Error / Empty / Grid */}
        <div className="mt-6">
          {isLoading && workspaces.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
              <p className="text-xs font-mono">Loading workspaces...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs text-rose-200 font-medium">Failed to load workspaces: {error}</p>
                <button
                  onClick={fetchWorkspaces}
                  className="text-xs text-rose-400 hover:text-rose-300 underline font-mono"
                >
                  Click here to retry
                </button>
              </div>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <div className="p-3 rounded-xl bg-slate-900 text-slate-400 mb-3 border border-slate-800">
                <FolderGit2 className="h-6 w-6 text-sky-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">No workspaces yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                Workspaces are isolated environments for your API mock definitions and failure simulation rules.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-lg shadow-sky-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create your first workspace</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  workspace={ws}
                  onRename={(target) => setEditingWorkspace(target)}
                  onDelete={(target) => setDeletingWorkspace(target)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Workspace Modal */}
      <WorkspaceModal
        isOpen={isCreateOpen}
        mode="create"
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Rename Workspace Modal */}
      <WorkspaceModal
        isOpen={editingWorkspace !== null}
        mode="edit"
        initialName={editingWorkspace?.name || ''}
        onClose={() => setEditingWorkspace(null)}
        onSubmit={handleRename}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deletingWorkspace !== null}
        workspaceName={deletingWorkspace?.name || ''}
        onClose={() => setDeletingWorkspace(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
