import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import type { Workspace } from '../types/workspace';
import type { Project } from '../types/project';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectModal } from '../components/projects/ProjectModal';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal';
import {
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  Folder,
  Copy,
  Check,
  Calendar,
  Layers,
  ArrowLeft,
} from 'lucide-react';

export const WorkspaceDetailsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedWsId, setCopiedWsId] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [ws, projList] = await Promise.all([
        workspaceService.getWorkspace(workspaceId),
        projectService.listProjects(workspaceId),
      ]);
      setWorkspace(ws);
      setProjects(projList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspace data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (data: { name: string; description: string | null }) => {
    if (!workspaceId) return;
    const newProj = await projectService.createProject(workspaceId, data);
    setProjects((prev) => [newProj, ...prev]);
  };

  const handleUpdate = async (data: { name: string; description: string | null }) => {
    if (!editingProject) return;
    const updated = await projectService.updateProject(editingProject.id, data);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDelete = async () => {
    if (!deletingProject) return;
    await projectService.deleteProject(deletingProject.id);
    setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
  };

  const handleCopyWsId = async () => {
    if (!workspace) return;
    try {
      await navigator.clipboard.writeText(workspace.id);
      setCopiedWsId(true);
      setTimeout(() => setCopiedWsId(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (isLoading && !workspace) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        <p className="text-sm font-mono">Loading workspace details...</p>
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-900 flex flex-col items-center text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-400" />
          <div>
            <h3 className="text-base font-semibold text-white">Workspace Inaccessible</h3>
            <p className="text-xs text-rose-300 mt-1 max-w-md">{error}</p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const formattedWsDate = workspace
    ? new Date(workspace.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-slate-400">
        <Link to="/dashboard" className="hover:text-slate-200 transition-colors flex items-center space-x-1">
          <span>Workspaces</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
        <span className="text-slate-100 font-semibold truncate max-w-xs">{workspace?.name}</span>
      </nav>

      {/* Workspace Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 rounded-xl bg-sky-950 border border-sky-800/80 text-sky-400 mt-0.5">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl font-bold text-white tracking-tight">{workspace?.name}</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Workspace
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
              <div className="flex items-center space-x-1.5 font-mono">
                <span className="text-slate-500">ID:</span>
                <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 text-[11px] text-slate-300 truncate max-w-[200px]">
                  {workspace?.id}
                </span>
                <button
                  onClick={handleCopyWsId}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                  title={copiedWsId ? 'Copied ID!' : 'Copy workspace ID'}
                  aria-label="Copy workspace ID"
                >
                  {copiedWsId ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <span className="text-slate-700">•</span>

              <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>Created {formattedWsDate}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Workspaces</span>
          </Link>
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-white">Projects</h3>
              <span className="text-xs text-indigo-400 font-mono bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulated services, microservices, and API configurations belonging to this workspace
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={loadData}
              disabled={isLoading}
              title="Refresh projects"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Project</span>
            </button>
          </div>
        </div>

        {/* Content area: Loading / Error / Empty / Grid */}
        <div className="mt-6">
          {isLoading && projects.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <p className="text-xs font-mono">Loading projects...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs text-rose-200 font-medium">Failed to load projects: {error}</p>
                <button
                  onClick={loadData}
                  className="text-xs text-rose-400 hover:text-rose-300 underline font-mono"
                >
                  Click here to retry
                </button>
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <div className="p-3 rounded-xl bg-slate-900 text-slate-400 mb-3 border border-slate-800">
                <Layers className="h-6 w-6 text-indigo-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">No projects in this workspace</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                Create a project to represent an API service or microservice whose latency, jitter, and error behaviors you want to test.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create your first project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  onEdit={(target) => setEditingProject(target)}
                  onDelete={(target) => setDeletingProject(target)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <ProjectModal
        isOpen={isCreateOpen}
        mode="create"
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Edit Project Modal */}
      <ProjectModal
        isOpen={editingProject !== null}
        mode="edit"
        initialName={editingProject?.name || ''}
        initialDescription={editingProject?.description || ''}
        onClose={() => setEditingProject(null)}
        onSubmit={handleUpdate}
      />

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={deletingProject !== null}
        projectName={deletingProject?.name || ''}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
