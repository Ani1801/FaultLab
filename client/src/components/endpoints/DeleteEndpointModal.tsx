import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { MockEndpoint } from '../../types/endpoint';

interface DeleteEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  endpoint: MockEndpoint | null;
}

export const DeleteEndpointModal: React.FC<DeleteEndpointModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  endpoint,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !endpoint) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete endpoint';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center space-x-3 text-rose-400 mb-4">
          <div className="p-2.5 bg-rose-500/10 rounded-lg border border-rose-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Delete Mock Endpoint</h3>
            <p className="text-xs text-slate-400">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">
            [{endpoint.method}] {endpoint.path}
          </span>
          ? Any clients requesting this simulated endpoint will receive a 404 response.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Endpoint</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

