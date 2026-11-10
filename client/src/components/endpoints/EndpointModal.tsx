import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Sparkles, Zap, Clock, ShieldAlert } from 'lucide-react';
import type { MockEndpoint, HttpMethod, FailureMode, CreateEndpointDTO } from '../../types/endpoint';

interface EndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEndpointDTO) => Promise<void>;
  initialData?: MockEndpoint | null;
}

const COMMON_STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 500];
const COMMON_FAULT_CODES = [500, 502, 503, 504, 400, 401, 403, 404, 429];

export const EndpointModal: React.FC<EndpointModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const isEditing = Boolean(initialData);

  // Normal Endpoint Config
  const [name, setName] = useState('');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState('');
  const [statusCode, setStatusCode] = useState<number>(200);
  const [responseDelay, setResponseDelay] = useState<number>(0);
  const [responseBodyText, setResponseBodyText] = useState('{\n  "message": "success"\n}');
  const [responseHeadersText, setResponseHeadersText] = useState('');

  // Phase 5 Fault Injection Config
  const [faultEnabled, setFaultEnabled] = useState<boolean>(false);
  const [failureMode, setFailureMode] = useState<FailureMode>('NONE');
  const [failureRate, setFailureRate] = useState<number>(0);
  const [failureStatusCode, setFailureStatusCode] = useState<number>(500);
  const [failureResponseBodyText, setFailureResponseBodyText] = useState(
    '{\n  "error": "Internal Server Error",\n  "message": "Simulated fault injection"\n}'
  );
  const [additionalDelay, setAdditionalDelay] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setMethod(initialData.method);
      setPath(initialData.path);
      setStatusCode(initialData.statusCode);
      setResponseDelay(initialData.responseDelay);
      setResponseBodyText(
        initialData.responseBody !== undefined && initialData.responseBody !== null
          ? JSON.stringify(initialData.responseBody, null, 2)
          : ''
      );
      setResponseHeadersText(
        initialData.responseHeaders && Object.keys(initialData.responseHeaders).length > 0
          ? JSON.stringify(initialData.responseHeaders, null, 2)
          : ''
      );

      // Fault fields
      setFaultEnabled(Boolean(initialData.faultEnabled));
      setFailureMode(initialData.failureMode || 'NONE');
      setFailureRate(initialData.failureRate ?? 0);
      setFailureStatusCode(initialData.failureStatusCode ?? 500);
      setFailureResponseBodyText(
        initialData.failureResponseBody !== undefined && initialData.failureResponseBody !== null
          ? JSON.stringify(initialData.failureResponseBody, null, 2)
          : '{\n  "error": "Internal Server Error",\n  "message": "Simulated fault injection"\n}'
      );
      setAdditionalDelay(initialData.additionalDelay ?? 0);
    } else {
      setName('');
      setMethod('GET');
      setPath('/');
      setStatusCode(200);
      setResponseDelay(0);
      setResponseBodyText('{\n  "message": "success"\n}');
      setResponseHeadersText('');

      // Fault defaults
      setFaultEnabled(false);
      setFailureMode('NONE');
      setFailureRate(0);
      setFailureStatusCode(500);
      setFailureResponseBodyText(
        '{\n  "error": "Internal Server Error",\n  "message": "Simulated fault injection"\n}'
      );
      setAdditionalDelay(0);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Endpoint name must be at least 2 characters');
      return;
    }

    const trimmedPath = path.trim();
    if (!trimmedPath) {
      setError('Endpoint path is required');
      return;
    }

    if (/\s/.test(trimmedPath)) {
      setError('Endpoint path must not contain whitespace');
      return;
    }

    if (statusCode < 100 || statusCode > 599) {
      setError('Status code must be between 100 and 599');
      return;
    }

    if (responseDelay < 0 || responseDelay > 10000) {
      setError('Response delay must be between 0 and 10000 ms');
      return;
    }

    // Phase 5 Fault validations
    if (faultEnabled) {
      if (failureStatusCode < 400 || failureStatusCode > 599) {
        setError('Failure status code must be between 400 and 599');
        return;
      }
      if (failureRate < 0 || failureRate > 100) {
        setError('Failure probability must be between 0 and 100%');
        return;
      }
      if (additionalDelay < 0 || additionalDelay > 10000) {
        setError('Additional delay must be between 0 and 10000 ms');
        return;
      }
    }

    // Parse JSON normal body
    let parsedBody: any = {};
    if (responseBodyText.trim()) {
      try {
        parsedBody = JSON.parse(responseBodyText);
      } catch {
        setError('Normal response body contains invalid JSON');
        return;
      }
    } else {
      parsedBody = statusCode === 204 ? null : {};
    }

    // Parse JSON failure body
    let parsedFailureBody: any = { error: 'Internal Server Error', message: 'Simulated fault injection' };
    if (failureResponseBodyText.trim()) {
      try {
        parsedFailureBody = JSON.parse(failureResponseBodyText);
      } catch {
        setError('Failure response body contains invalid JSON');
        return;
      }
    }

    // Parse JSON headers
    let parsedHeaders: Record<string, string> | null = null;
    if (responseHeadersText.trim()) {
      try {
        const parsed = JSON.parse(responseHeadersText);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          setError('Response headers must be a JSON object of key-value string pairs');
          return;
        }
        parsedHeaders = parsed;
      } catch {
        setError('Response headers contains invalid JSON');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: trimmedName,
        method,
        path: trimmedPath,
        statusCode,
        responseBody: parsedBody,
        responseHeaders: parsedHeaders,
        responseDelay,
        faultEnabled,
        failureMode,
        failureRate,
        failureStatusCode,
        failureResponseBody: parsedFailureBody,
        additionalDelay,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save endpoint';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormatNormalJson = () => {
    try {
      if (responseBodyText.trim()) {
        const parsed = JSON.parse(responseBodyText);
        setResponseBodyText(JSON.stringify(parsed, null, 2));
      }
    } catch {
      setError('Cannot format: invalid JSON in normal response body');
    }
  };

  const handleFormatFailureJson = () => {
    try {
      if (failureResponseBodyText.trim()) {
        const parsed = JSON.parse(failureResponseBodyText);
        setFailureResponseBodyText(JSON.stringify(parsed, null, 2));
      }
    } catch {
      setError('Cannot format: invalid JSON in failure response body');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Mock Endpoint' : 'Create Mock Endpoint'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start space-x-2.5 text-rose-400 text-xs">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Endpoint Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Endpoint Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Process Payment Transaction"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required
              autoFocus
            />
          </div>

          {/* Method and Path Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                HTTP Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Path Pattern <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/payments or /users/:id"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Status Code and Delay Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Normal Status Code
              </label>
              <input
                type="number"
                min={100}
                max={599}
                value={statusCode}
                onChange={(e) => setStatusCode(parseInt(e.target.value, 10) || 200)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {COMMON_STATUS_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setStatusCode(code)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      statusCode === code
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Normal Delay (ms)
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                step={50}
                value={responseDelay}
                onChange={(e) => setResponseDelay(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Base latency simulation (0 - 10,000ms)
              </span>
            </div>
          </div>

          {/* Response Body (JSON) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Normal Response Body (JSON)
              </label>
              <button
                type="button"
                onClick={handleFormatNormalJson}
                className="inline-flex items-center space-x-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-mono"
              >
                <Sparkles className="h-3 w-3" />
                <span>Format JSON</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={responseBodyText}
              onChange={(e) => setResponseBodyText(e.target.value)}
              placeholder={`{\n  "message": "success"\n}`}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          {/* Response Headers (JSON) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Custom Headers (Optional JSON)
            </label>
            <textarea
              rows={2}
              value={responseHeadersText}
              onChange={(e) => setResponseHeadersText(e.target.value)}
              placeholder={`{\n  "X-Custom-Header": "value"\n}`}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* ==================================================== */}
          {/* PHASE 5: FAULT INJECTION & CHAOS SECTION             */}
          {/* ==================================================== */}
          <div className="p-4 bg-slate-950/80 border border-amber-900/40 rounded-xl space-y-4">
            {/* Toggle bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`p-1.5 rounded-lg border ${faultEnabled ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">
                    Fault Injection & Chaos Engine
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Simulate API failures and network latency for chaos testing
                  </span>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={faultEnabled}
                  onChange={(e) => setFaultEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {/* Expanded Fault Controls when faultEnabled */}
            {faultEnabled && (
              <div className="pt-3 border-t border-slate-800/80 space-y-4 animate-fade-in">
                {/* Failure Mode Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Failure Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['NONE', 'ALWAYS', 'RANDOM'] as FailureMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFailureMode(mode)}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold border transition-all text-center ${
                          failureMode === mode
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {mode === 'NONE' && 'NONE (Latency only)'}
                        {mode === 'ALWAYS' && 'ALWAYS (100% Fail)'}
                        {mode === 'RANDOM' && 'RANDOM (% Rate)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* If RANDOM: Failure Probability */}
                {failureMode === 'RANDOM' && (
                  <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-slate-300">
                        Failure Probability
                      </label>
                      <span className="font-mono text-amber-400 font-bold">
                        {failureRate}%
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={failureRate}
                        onChange={(e) => setFailureRate(parseInt(e.target.value, 10) || 0)}
                        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={failureRate}
                        onChange={(e) => setFailureRate(parseInt(e.target.value, 10) || 0)}
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-center text-xs font-mono text-white"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Approximately {failureRate}% of incoming requests will return the fault error response.
                    </span>
                  </div>
                )}

                {/* Fault Status & Additional Latency Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                      <span>Failure Status Code</span>
                    </label>
                    <input
                      type="number"
                      min={400}
                      max={599}
                      value={failureStatusCode}
                      onChange={(e) => setFailureStatusCode(parseInt(e.target.value, 10) || 500)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {COMMON_FAULT_CODES.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setFailureStatusCode(code)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                            failureStatusCode === code
                              ? 'bg-rose-600 text-white border-rose-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      <span>Additional Fault Delay (ms)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      step={50}
                      value={additionalDelay}
                      onChange={(e) => setAdditionalDelay(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Extra delay added to base latency (Total: {responseDelay + additionalDelay}ms)
                    </span>
                  </div>
                </div>

                {/* Custom Failure Response Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Failure Response Body (JSON)
                    </label>
                    <button
                      type="button"
                      onClick={handleFormatFailureJson}
                      className="inline-flex items-center space-x-1 text-[11px] text-amber-400 hover:text-amber-300 font-mono"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Format JSON</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={failureResponseBodyText}
                    onChange={(e) => setFailureResponseBodyText(e.target.value)}
                    placeholder={`{\n  "error": "Internal Server Error"\n}`}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-rose-300 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Endpoint'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
