import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Copy, Check, Edit3, Trash2, Calendar, ArrowRight } from 'lucide-react';
import type { Workspace } from '../../types/workspace';

interface WorkspaceCardProps {
  workspace: Workspace;
  onRename: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspace,
  onRename,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedDate = new Date(workspace.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(workspace.id);
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
          <Link
            to={`/workspaces/${workspace.id}`}
            className="p-2.5 rounded-lg bg-sky-950/70 border border-sky-800/60 text-sky-400 group-hover:border-sky-700 transition-colors cursor-pointer"
            title="Open workspace"
          >
            <Folder className="h-5 w-5" />
          </Link>

          <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onRename(workspace)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Rename workspace"
              aria-label={`Rename ${workspace.name}`}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(workspace)}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Delete workspace"
              aria-label={`Delete ${workspace.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Workspace Name (clickable link) */}
        <Link
          to={`/workspaces/${workspace.id}`}
          className="text-base font-semibold text-white mt-3.5 tracking-tight line-clamp-1 hover:text-sky-400 transition-colors flex items-center justify-between group/link"
        >
          <span>{workspace.name}</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover/link:text-sky-400 group-hover/link:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
        </Link>

        {/* ID badge with copy */}
        <div className="mt-2 flex items-center space-x-2">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800/80 truncate max-w-[210px]">
            {workspace.id}
          </span>
          <button
            onClick={handleCopyId}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title={copied ? 'Copied ID!' : 'Copy full ID'}
            aria-label="Copy workspace ID"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Footer metadata & Open CTA */}
      <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[11px] font-mono">{formattedDate}</span>
        </div>
        <Link
          to={`/workspaces/${workspace.id}`}
          className="inline-flex items-center space-x-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 transition-colors"
        >
          <span>View Projects</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};
