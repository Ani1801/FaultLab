import React, { useState, useEffect } from 'react';
import { X, Loader2, FolderKanban, Edit3 } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialDescription?: string | null;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string | null }) => Promise<void>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  mode,
  initialName = '',
  initialDescription = '',
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription || '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialName, initialDescription]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Project name is required');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Project name must be at least 2 characters');
      return;
    }

    if (trimmedName.length > 64) {
      setError('Project name cannot exceed 64 characters');
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length > 500) {
      setError('Description cannot exceed 500 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        description: trimmedDesc.length > 0 ? trimmedDesc : null,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreate = mode === 'create';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/80">
              {isCreate ? <FolderKanban className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            </div>
            <h3 id="project-modal-title" className="text-base font-semibold text-white">
              {isCreate ? 'Create Project' : 'Edit Project Details'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-800"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="projectName" className="block text-xs font-medium text-slate-300 mb-1.5">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="projectName"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Payment Gateway Failure Simulation"
              maxLength={64}
              disabled={isSubmitting}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all disabled:opacity-50"
            />
            <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-500 font-mono">
              <span>Between 2 and 64 characters</span>
              <span>{name.length}/64</span>
            </div>
          </div>

          <div>
            <label htmlFor="projectDescription" className="block text-xs font-medium text-slate-300 mb-1.5">
              Description <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              id="projectDescription"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Brief description of the simulated service, API contracts, or failure testing scenarios..."
              maxLength={500}
              disabled={isSubmitting}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all resize-none disabled:opacity-50"
            />
            <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500 font-mono">
              <span>Leave blank to clear description</span>
              <span>{description.length}/500</span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-lg shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isCreate ? 'Create Project' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

