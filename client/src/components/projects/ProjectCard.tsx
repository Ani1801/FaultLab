import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Copy, Check, Edit3, Trash2, Calendar, FileText, ArrowRight } from 'lucide-react';
import type { Project } from '../../types/project';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onEdit,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(project.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 shadow-lg transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Top bar: Icon and action buttons */}
        <div className="flex items-start justify-between">
          <div className="p-2.5 rounded-lg bg-indigo-950/70 border border-indigo-800/60 text-indigo-400 group-hover:border-indigo-700 transition-colors">
            <FolderKanban className="h-5 w-5" />
          </div>

          <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(project)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Edit project"
              aria-label={`Edit ${project.name}`}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(project)}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Delete project"
              aria-label={`Delete ${project.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Project Name */}
        <Link
          to={`/projects/${project.id}`}
          className="text-base font-semibold text-white hover:text-indigo-400 mt-3.5 tracking-tight line-clamp-1 block transition-colors"
        >
          {project.name}
        </Link>

        {/* Project Description */}
        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed min-h-[32px]">
          {project.description || (
            <span className="text-slate-600 italic flex items-center space-x-1">
              <FileText className="h-3 w-3 inline mr-1" />
              No description provided
            </span>
          )}
        </p>

        {/* ID badge with copy */}
        <div className="mt-3 flex items-center space-x-2">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800/80 truncate max-w-[210px]">
            {project.id}
          </span>
          <button
            onClick={handleCopyId}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title={copied ? 'Copied ID!' : 'Copy full ID'}
            aria-label="Copy project ID"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Footer metadata */}
      <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[11px] font-mono">{formattedDate}</span>
        </div>
        <Link
          to={`/projects/${project.id}`}
          className="inline-flex items-center space-x-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <span>Endpoints</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};

