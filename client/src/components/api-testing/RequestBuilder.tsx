import React, { useState } from 'react';
import type {
  HttpMethod,
  AuthType,
  KeyValuePair,
  JsonAssertion,
  AssertionOperator,
  AuthConfigInput,
} from '../../types/apiTesting';
import {
  Send,
  Save,
  Plus,
  Trash2,
  Code2,
  Lock,
  Layers,
  Sliders,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface RequestBuilderProps {
  method: HttpMethod;
  setMethod: (m: HttpMethod) => void;
  url: string;
  setUrl: (url: string) => void;
  queryParams: KeyValuePair[];
  setQueryParams: React.Dispatch<React.SetStateAction<KeyValuePair[]>>;
  headers: KeyValuePair[];
  setHeaders: React.Dispatch<React.SetStateAction<KeyValuePair[]>>;
  authType: AuthType;
  setAuthType: (t: AuthType) => void;
  authConfig: AuthConfigInput;
  setAuthConfig: React.Dispatch<React.SetStateAction<AuthConfigInput>>;
  hasStoredCredentials?: boolean;
  requestBody: string;
  setRequestBody: (b: string) => void;
  expectedStatusCode: number | null;
  setExpectedStatusCode: (c: number | null) => void;
  maxResponseTime: number | null;
  setMaxResponseTime: (t: number | null) => void;
  assertions: JsonAssertion[];
  setAssertions: React.Dispatch<React.SetStateAction<JsonAssertion[]>>;
  onSend: () => void;
  onSave: () => void;
  isSending?: boolean;
  isSaving?: boolean;
  activeTestName?: string | null;
}

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  method,
  setMethod,
  url,
  setUrl,
  queryParams,
  setQueryParams,
  headers,
  setHeaders,
  authType,
  setAuthType,
  authConfig,
  setAuthConfig,
  hasStoredCredentials,
  requestBody,
  setRequestBody,
  expectedStatusCode,
  setExpectedStatusCode,
  maxResponseTime,
  setMaxResponseTime,
  assertions,
  setAssertions,
  onSend,
  onSave,
  isSending,
  isSaving,
  activeTestName,
}) => {
  const [activeSubtab, setActiveSubtab] = useState<'params' | 'headers' | 'auth' | 'body' | 'assertions'>('params');

  const methodColors: Record<HttpMethod, string> = {
    GET: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    POST: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };

  // Query Params helpers
  const addParam = () => setQueryParams((prev) => [...prev, { key: '', value: '', enabled: true }]);
  const updateParam = (index: number, field: 'key' | 'value' | 'enabled', val: any) => {
    setQueryParams((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index]!, [field]: val };
      }
      return copy;
    });
  };
  const removeParam = (index: number) => setQueryParams((prev) => prev.filter((_, i) => i !== index));

  // Headers helpers
  const addHeader = () => setHeaders((prev) => [...prev, { key: '', value: '', enabled: true }]);
  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', val: any) => {
    setHeaders((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index]!, [field]: val };
      }
      return copy;
    });
  };
  const removeHeader = (index: number) => setHeaders((prev) => prev.filter((_, i) => i !== index));

  // Assertions helpers
  const addAssertion = () => setAssertions((prev) => [...prev, { field: '', operator: 'EQUALS', value: '' }]);
  const updateAssertion = (index: number, field: keyof JsonAssertion, val: any) => {
    setAssertions((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index]!, [field]: val };
      }
      return copy;
    });
  };
  const removeAssertion = (index: number) => setAssertions((prev) => prev.filter((_, i) => i !== index));

  const formatJsonBody = () => {
    try {
      const parsed = JSON.parse(requestBody);
      setRequestBody(JSON.stringify(parsed, null, 2));
    } catch {
      // Keep existing text if invalid JSON
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Active Test Banner if viewing a saved test */}
      {activeTestName && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-indigo-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>Editing Test: {activeTestName}</span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">Saved Configuration</span>
        </div>
      )}

      {/* Main Request Input Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Method selector */}
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className={`px-3 py-2 bg-slate-950 border rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${methodColors[method]}`}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>

        {/* URL Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend();
            }}
            placeholder="https://api.example.com/v1/resource"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSend}
            disabled={isSending || !url.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-md shadow-indigo-600/20"
          >
            {isSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !url.trim()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
            title="Save test configuration"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Subtabs Bar */}
      <div className="border-b border-slate-800/80 flex items-center gap-4 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveSubtab('params')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
            activeSubtab === 'params'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Params</span>
          {queryParams.filter((p) => p.enabled !== false && p.key).length > 0 && (
            <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px]">
              {queryParams.filter((p) => p.enabled !== false && p.key).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('headers')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
            activeSubtab === 'headers'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Headers</span>
          {headers.filter((h) => h.enabled !== false && h.key).length > 0 && (
            <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px]">
              {headers.filter((h) => h.enabled !== false && h.key).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('auth')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
            activeSubtab === 'auth'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Auth</span>
          {authType !== 'NONE' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('body')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
            activeSubtab === 'body'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Body</span>
          {requestBody.trim().length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('assertions')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
            activeSubtab === 'assertions'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Expectations</span>
          {(expectedStatusCode || maxResponseTime || assertions.length > 0) && (
            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px]">
              {(expectedStatusCode ? 1 : 0) + (maxResponseTime ? 1 : 0) + assertions.length}
            </span>
          )}
        </button>
      </div>

      {/* Subtab 1: Query Params */}
      {activeSubtab === 'params' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Query Parameters</span>
            <button
              type="button"
              onClick={addParam}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Param
            </button>
          </div>
          {queryParams.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No query parameters configured.</p>
          ) : (
            <div className="space-y-2">
              {queryParams.map((param, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={param.enabled !== false}
                    onChange={(e) => updateParam(idx, 'enabled', e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <input
                    type="text"
                    placeholder="Key"
                    value={param.key}
                    onChange={(e) => updateParam(idx, 'key', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => updateParam(idx, 'value', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeParam(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: Headers */}
      {activeSubtab === 'headers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Request Headers</span>
            <button
              type="button"
              onClick={addHeader}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Header
            </button>
          </div>
          {headers.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No custom headers configured.</p>
          ) : (
            <div className="space-y-2">
              {headers.map((header, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={header.enabled !== false}
                    onChange={(e) => updateHeader(idx, 'enabled', e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <input
                    type="text"
                    placeholder="Header Name (e.g. Accept)"
                    value={header.key}
                    onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Header Value"
                    value={header.value}
                    onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeHeader(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subtab 3: Auth */}
      {activeSubtab === 'auth' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-xs text-slate-400">Authentication Method:</label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="NONE">No Authentication</option>
              <option value="BEARER">Bearer Token</option>
              <option value="BASIC">Basic Authentication</option>
              <option value="API_KEY">API Key</option>
            </select>
          </div>

          {authType === 'BEARER' && (
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Bearer Token</label>
              <input
                type="password"
                placeholder={hasStoredCredentials ? '••••••••  (Stored securely on server)' : 'Enter bearer token'}
                value={authConfig.token || ''}
                onChange={(e) => setAuthConfig((prev) => ({ ...prev, token: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {authType === 'BASIC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={authConfig.username || ''}
                  onChange={(e) => setAuthConfig((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Password</label>
                <input
                  type="password"
                  placeholder={hasStoredCredentials ? '••••••••' : 'Password'}
                  value={authConfig.password || ''}
                  onChange={(e) => setAuthConfig((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {authType === 'API_KEY' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Key Name</label>
                <input
                  type="text"
                  placeholder="X-API-Key"
                  value={authConfig.key || ''}
                  onChange={(e) => setAuthConfig((prev) => ({ ...prev, key: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Key Value</label>
                <input
                  type="password"
                  placeholder={hasStoredCredentials ? '••••••••' : 'Key value'}
                  value={authConfig.value || ''}
                  onChange={(e) => setAuthConfig((prev) => ({ ...prev, value: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Add To</label>
                <select
                  value={authConfig.addTo || 'HEADER'}
                  onChange={(e) => setAuthConfig((prev) => ({ ...prev, addTo: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="HEADER">HTTP Header</option>
                  <option value="QUERY">Query Parameter</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab 4: Body */}
      {activeSubtab === 'body' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Request Body (JSON or Text)</span>
            <button
              type="button"
              onClick={formatJsonBody}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Format JSON
            </button>
          </div>
          <textarea
            rows={7}
            placeholder={'{\n  "key": "value"\n}'}
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Subtab 5: Expectations & Assertions */}
      {activeSubtab === 'assertions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-800/80">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Expected Status Code</label>
              <input
                type="number"
                placeholder="200"
                value={expectedStatusCode !== null ? expectedStatusCode : ''}
                onChange={(e) => setExpectedStatusCode(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Maximum Latency (ms)</label>
              <input
                type="number"
                placeholder="2000"
                value={maxResponseTime !== null ? maxResponseTime : ''}
                onChange={(e) => setMaxResponseTime(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>JSON Body Path Assertions</span>
              <button
                type="button"
                onClick={addAssertion}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add JSON Assertion
              </button>
            </div>

            {assertions.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No JSON path assertions configured.</p>
            ) : (
              <div className="space-y-2">
                {assertions.map((assertion, idx) => (
                  <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Path (e.g. data.id, status)"
                      value={assertion.field}
                      onChange={(e) => updateAssertion(idx, 'field', e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <select
                      value={assertion.operator}
                      onChange={(e) => updateAssertion(idx, 'operator', e.target.value as AssertionOperator)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="EQUALS">EQUALS</option>
                      <option value="NOT_EQUALS">NOT EQUALS</option>
                      <option value="EXISTS">EXISTS</option>
                      <option value="NOT_EXISTS">NOT EXISTS</option>
                      <option value="GREATER_THAN">GREATER THAN</option>
                      <option value="LESS_THAN">LESS THAN</option>
                      <option value="CONTAINS">CONTAINS</option>
                    </select>
                    {!['EXISTS', 'NOT_EXISTS'].includes(assertion.operator) && (
                      <input
                        type="text"
                        placeholder="Expected value"
                        value={assertion.value !== undefined ? assertion.value : ''}
                        onChange={(e) => updateAssertion(idx, 'value', e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeAssertion(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

