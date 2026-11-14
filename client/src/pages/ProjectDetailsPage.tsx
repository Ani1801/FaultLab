import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { endpointService } from '../services/endpointService';
import { workspaceService } from '../services/workspaceService';
import { requestLogService } from '../services/requestLogService';
import { apiTestingService } from '../services/apiTestingService';
import type { Project } from '../types/project';
import type { MockEndpoint, CreateEndpointDTO } from '../types/endpoint';
import type { Workspace } from '../types/workspace';
import type {
  RequestLog,
  AnalyticsData,
  ListRequestLogsParams,
} from '../types/requestLog';
import type {
  ApiTest,
  ApiTestRun,
  HttpMethod,
  AuthType,
  KeyValuePair,
  JsonAssertion,
  AuthConfigInput,
} from '../types/apiTesting';
import { EndpointCard } from '../components/endpoints/EndpointCard';
import { EndpointModal } from '../components/endpoints/EndpointModal';
import { DeleteEndpointModal } from '../components/endpoints/DeleteEndpointModal';
import { AnalyticsOverview } from '../components/analytics/AnalyticsOverview';
import { RequestVolumeChart } from '../components/analytics/RequestVolumeChart';
import { RequestHistoryTable } from '../components/requests/RequestHistoryTable';
import { RequestDetailsDrawer } from '../components/requests/RequestDetailsDrawer';
import { RequestBuilder } from '../components/api-testing/RequestBuilder';
import { ResponseViewer } from '../components/api-testing/ResponseViewer';
import { SavedTestsList } from '../components/api-testing/SavedTestsList';
import { TestRunHistoryModal } from '../components/api-testing/TestRunHistoryModal';
import { SaveTestModal } from '../components/api-testing/SaveTestModal';
import { DiagnosticOverviewModal } from '../components/api-testing/DiagnosticOverviewModal';
import { agentService } from '../services/agentService';
import type { LocalAgent } from '../types/agent';
import { AgentPairingModal } from '../components/agents/AgentPairingModal';
import { AgentStatusCard } from '../components/agents/AgentStatusCard';
import {
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  Copy,
  Check,
  Globe,
  Terminal,
  FolderKanban,
  Search,
  SlidersHorizontal,
  Activity,
  Layers,
  FlaskConical,
  ShieldAlert,
} from 'lucide-react';

type TabType = 'endpoints' | 'analytics' | 'api-testing';

export const ProjectDetailsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('endpoints');

  // Project & Endpoint State
  const [project, setProject] = useState<Project | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [endpoints, setEndpoints] = useState<MockEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Endpoint Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');

  // URL Copy state
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);

  // Endpoint Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<MockEndpoint | null>(null);
  const [deletingEndpoint, setDeletingEndpoint] = useState<MockEndpoint | null>(null);

  // Analytics & Request History State
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    faultInjectedRequests: 0,
    successRate: 0,
    avgResponseTime: 0,
    minResponseTime: 0,
    maxResponseTime: 0,
    statusBreakdown: [],
    methodBreakdown: [],
    volumeOverTime: [],
    timeRange: '24h',
  });
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Request logs table state
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [requestPagination, setRequestPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [requestFilterParams, setRequestFilterParams] = useState<ListRequestLogsParams>({
    page: 1,
    limit: 20,
  });
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  // Real API Testing State
  const [apiTests, setApiTests] = useState<ApiTest[]>([]);
  const [isApiTestsLoading, setIsApiTestsLoading] = useState(false);
  const [selectedApiTest, setSelectedApiTest] = useState<ApiTest | null>(null);

  // Request Builder State
  const [builderMethod, setBuilderMethod] = useState<HttpMethod>('GET');
  const [builderUrl, setBuilderUrl] = useState('https://jsonplaceholder.typicode.com/todos/1');
  const [builderQueryParams, setBuilderQueryParams] = useState<KeyValuePair[]>([
    { key: '', value: '', enabled: true },
  ]);
  const [builderHeaders, setBuilderHeaders] = useState<KeyValuePair[]>([
    { key: 'Accept', value: 'application/json', enabled: true },
  ]);
  const [builderAuthType, setBuilderAuthType] = useState<AuthType>('NONE');
  const [builderAuthConfig, setBuilderAuthConfig] = useState<AuthConfigInput>({});
  const [builderRequestBody, setBuilderRequestBody] = useState('');
  const [builderExpectedStatusCode, setBuilderExpectedStatusCode] = useState<number | null>(200);
  const [builderMaxResponseTime, setBuilderMaxResponseTime] = useState<number | null>(2000);
  const [builderAssertions, setBuilderAssertions] = useState<JsonAssertion[]>([
    { field: 'id', operator: 'EXISTS' },
  ]);

  // API Testing Execution State
  const [currentRun, setCurrentRun] = useState<ApiTestRun | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);

  // API Testing Modals
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [historyModalTest, setHistoryModalTest] = useState<ApiTest | null>(null);
  const [isDiagnosticsOverviewOpen, setIsDiagnosticsOverviewOpen] = useState(false);

  // Local Diagnostic Agent State
  const [agents, setAgents] = useState<LocalAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isRevokingAgent, setIsRevokingAgent] = useState(false);

  const mockBaseUrl = useMemo(() => {
    if (!projectId) return '';
    // In production (e.g. deployed on Vercel), mock requests are routed via same-origin reverse proxy
    if (import.meta.env.PROD) {
      return `${window.location.origin}/mock/${projectId}`;
    }
    // In local development, mock server runs on port 5000
    const protocol = window.location.protocol;
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:5000/mock/${projectId}`;
  }, [projectId]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const proj = await projectService.getProject(projectId);
      setProject(proj);

      const [ws, eps] = await Promise.all([
        workspaceService.getWorkspace(proj.workspaceId).catch(() => null),
        endpointService.listEndpoints(projectId),
      ]);

      if (ws) setWorkspace(ws);
      setEndpoints(eps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load project details';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load Analytics Data
  const loadAnalytics = useCallback(
    async (range: '24h' | '7d' | '30d' = timeRange) => {
      if (!projectId) return;
      setIsAnalyticsLoading(true);
      try {
        const res = await requestLogService.getAnalytics(projectId, range);
        setAnalytics(res.analytics);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setIsAnalyticsLoading(false);
      }
    },
    [projectId, timeRange]
  );

  // Load Request History Logs
  const loadRequests = useCallback(
    async (params: ListRequestLogsParams = requestFilterParams) => {
      if (!projectId) return;
      setIsRequestsLoading(true);
      try {
        const res = await requestLogService.listRequests(projectId, params);
        setRequestLogs(res.data);
        setRequestPagination(res.pagination);
      } catch (err) {
        console.error('Failed to load request history:', err);
      } finally {
        setIsRequestsLoading(false);
      }
    },
    [projectId, requestFilterParams]
  );

  // Load API Tests
  const loadApiTests = useCallback(async () => {
    if (!projectId) return;
    setIsApiTestsLoading(true);
    try {
      const tests = await apiTestingService.listApiTests(projectId);
      setApiTests(tests);
    } catch (err) {
      console.error('Failed to load API tests:', err);
    } finally {
      setIsApiTestsLoading(false);
    }
  }, [projectId]);

  const loadAgents = useCallback(async () => {
    if (!projectId) return;
    try {
      const list = await agentService.listAgents(projectId);
      setAgents(list);
    } catch {
      // Best effort
    }
  }, [projectId]);

  const handleRevokeAgent = async (agentId: string) => {
    if (!projectId) return;
    setIsRevokingAgent(true);
    try {
      await agentService.revokeAgent(projectId, agentId);
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }
      await loadAgents();
    } catch (err: any) {
      console.error('Failed to revoke agent:', err);
    } finally {
      setIsRevokingAgent(false);
    }
  };

  useEffect(() => {
    loadData();
    loadApiTests();
    loadAgents();
  }, [loadData, loadApiTests, loadAgents]);

  // When switching tabs, reload corresponding data
  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics(timeRange);
      loadRequests(requestFilterParams);
    } else if (activeTab === 'api-testing') {
      loadApiTests();
      loadAgents();
    }
  }, [activeTab, timeRange, requestFilterParams, loadAnalytics, loadRequests, loadApiTests, loadAgents]);

  const handleCopyBaseUrl = async () => {
    if (!mockBaseUrl) return;
    try {
      await navigator.clipboard.writeText(mockBaseUrl);
      setCopiedBaseUrl(true);
      setTimeout(() => setCopiedBaseUrl(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCreateEndpoint = async (data: CreateEndpointDTO) => {
    if (!projectId) return;
    const created = await endpointService.createEndpoint(projectId, data);
    setEndpoints((prev) => [...prev, created]);
  };

  const handleUpdateEndpoint = async (data: CreateEndpointDTO) => {
    if (!editingEndpoint) return;
    const updated = await endpointService.updateEndpoint(editingEndpoint.id, data);
    setEndpoints((prev) => prev.map((ep) => (ep.id === updated.id ? updated : ep)));
  };

  const handleDeleteEndpoint = async () => {
    if (!deletingEndpoint) return;
    await endpointService.deleteEndpoint(deletingEndpoint.id);
    setEndpoints((prev) => prev.filter((ep) => ep.id !== deletingEndpoint.id));
  };

  // API Testing: Select a saved test to load into builder
  const handleSelectApiTest = (test: ApiTest) => {
    setSelectedApiTest(test);
    setBuilderMethod(test.method);
    setBuilderUrl(test.url);
    setBuilderQueryParams(
      test.queryParams?.length
        ? test.queryParams.map((q) => ({ ...q, enabled: q.enabled !== false }))
        : [{ key: '', value: '', enabled: true }]
    );
    setBuilderHeaders(
      test.headers?.length
        ? test.headers.map((h) => ({ ...h, enabled: h.enabled !== false }))
        : [{ key: '', value: '', enabled: true }]
    );
    setBuilderAuthType(test.authenticationType);
    setBuilderAuthConfig({});
    setBuilderRequestBody(test.requestBody || '');
    setBuilderExpectedStatusCode(test.expectedStatusCode);
    setBuilderMaxResponseTime(test.maxResponseTime);
    setBuilderAssertions(test.expectedResponse || []);
    setCurrentRun(null);
  };

  // API Testing: Reset builder for a brand new test
  const handleNewApiTest = () => {
    setSelectedApiTest(null);
    setBuilderMethod('GET');
    setBuilderUrl('https://jsonplaceholder.typicode.com/todos/1');
    setBuilderQueryParams([{ key: '', value: '', enabled: true }]);
    setBuilderHeaders([{ key: 'Accept', value: 'application/json', enabled: true }]);
    setBuilderAuthType('NONE');
    setBuilderAuthConfig({});
    setBuilderRequestBody('');
    setBuilderExpectedStatusCode(200);
    setBuilderMaxResponseTime(2000);
    setBuilderAssertions([{ field: 'id', operator: 'EXISTS' }]);
    setCurrentRun(null);
  };

  // API Testing: Send Request (Execute Unsaved / Interactive Run)
  const handleSendRequest = async () => {
    if (!projectId || !builderUrl.trim()) return;

    setIsSending(true);
    try {
      if (selectedAgentId) {
        // Enqueue execution on local agent
        const queryParamsObj: Record<string, string> = {};
        builderQueryParams
          .filter((p) => p.key.trim() && p.enabled !== false)
          .forEach((p) => {
            queryParamsObj[p.key.trim()] = p.value;
          });

        const headersObj: Record<string, string> = {};
        builderHeaders
          .filter((h) => h.key.trim() && h.enabled !== false)
          .forEach((h) => {
            headersObj[h.key.trim()] = h.value;
          });

        let parsedBody: any = undefined;
        if (builderRequestBody.trim()) {
          try {
            parsedBody = JSON.parse(builderRequestBody);
          } catch {
            parsedBody = builderRequestBody;
          }
        }

        const task = await agentService.enqueueExecution(projectId, {
          agentId: selectedAgentId,
          url: builderUrl.trim(),
          method: builderMethod,
          queryParams: Object.keys(queryParamsObj).length > 0 ? queryParamsObj : undefined,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          body: parsedBody,
          timeoutMs: 15000,
          testConfig: {
            id: selectedApiTest?.id,
            name: selectedApiTest?.name || 'Local Diagnostic Test',
            assertions: builderAssertions
              .filter((a) => a.field.trim())
              .map((a) => ({
                field: a.field,
                operator: a.operator,
                expectedValue: a.value !== undefined ? String(a.value) : '',
              })),
          },
        });

        // Poll task status until complete or failed (max 30s)
        const startTime = Date.now();
        let finished = false;
        while (!finished && Date.now() - startTime < 30000) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          const updatedTask = await agentService.getTask(projectId, task.id);
          if (updatedTask.status === 'COMPLETED' || updatedTask.status === 'FAILED') {
            finished = true;
            if (updatedTask.apiTestRun) {
              setCurrentRun(updatedTask.apiTestRun);
            } else if (updatedTask.result) {
              setCurrentRun({
                id: 'agent-' + updatedTask.id,
                projectId,
                apiTestId: selectedApiTest?.id || null,
                status: updatedTask.status === 'COMPLETED' ? 'PASSED' : 'FAILED',
                actualStatusCode: updatedTask.result.statusCode,
                responseTime: updatedTask.result.responseTime,
                responseSize: updatedTask.result.responseSize,
                responseHeaders: updatedTask.result.responseHeaders,
                assertionResults: [],
                sanitizedResponseBody: updatedTask.result.rawBody,
                errorMessage: updatedTask.result.errorMessage || null,
                executedAt: new Date().toISOString(),
                diagnosticReport: updatedTask.diagnosticReport as any,
              });
            }
            break;
          }
        }

        if (!finished) {
          throw new Error('Local agent execution timed out waiting for agent response.');
        }

        loadApiTests();
        return;
      }

      let run: ApiTestRun;
      if (selectedApiTest) {
        // Executing a saved test: persist execution run and link to the saved test ID
        run = await apiTestingService.executeUnsavedTest(projectId, {
          apiTestId: selectedApiTest.id,
          method: builderMethod,
          url: builderUrl.trim(),
          queryParams: builderQueryParams.filter((p) => p.key.trim() && p.enabled !== false),
          headers: builderHeaders.filter((h) => h.key.trim() && h.enabled !== false),
          requestBody: builderRequestBody.trim() ? builderRequestBody : null,
          authenticationType: builderAuthType,
          authenticationConfig: builderAuthType !== 'NONE' ? builderAuthConfig : undefined,
          timeoutMs: 15000,
          expectedStatusCode: builderExpectedStatusCode,
          expectedResponse: builderAssertions.filter((a) => a.field.trim()),
          maxResponseTime: builderMaxResponseTime,
          saveRun: true,
        });
      } else {
        // Ephemeral unsaved request: execute without creating unwanted persistent history
        run = await apiTestingService.executeUnsavedTest(projectId, {
          method: builderMethod,
          url: builderUrl.trim(),
          queryParams: builderQueryParams.filter((p) => p.key.trim() && p.enabled !== false),
          headers: builderHeaders.filter((h) => h.key.trim() && h.enabled !== false),
          requestBody: builderRequestBody.trim() ? builderRequestBody : null,
          authenticationType: builderAuthType,
          authenticationConfig: builderAuthType !== 'NONE' ? builderAuthConfig : undefined,
          timeoutMs: 15000,
          expectedStatusCode: builderExpectedStatusCode,
          expectedResponse: builderAssertions.filter((a) => a.field.trim()),
          maxResponseTime: builderMaxResponseTime,
          saveRun: false,
        });
      }

      setCurrentRun(run);
      // Refresh saved tests to update last run indicators immediately
      await loadApiTests();
    } catch (err: any) {
      // Build synthetic error run
      const errMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Execution failed';
      setCurrentRun({
        id: 'error-' + Date.now(),
        projectId,
        apiTestId: selectedApiTest?.id || null,
        status: 'ERROR',
        actualStatusCode: null,
        responseTime: 0,
        responseSize: null,
        responseHeaders: {},
        assertionResults: [],
        sanitizedResponseBody: null,
        errorMessage: errMsg,
        executedAt: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
    }
  };

  // API Testing: Run Saved Test directly from sidebar
  const handleRunSavedTest = async (test: ApiTest) => {
    setRunningTestId(test.id);
    try {
      const res = await apiTestingService.runApiTest(test.id);
      setCurrentRun(res.run);
      // Update in test list
      setApiTests((prev) => prev.map((t) => (t.id === test.id ? res.test : t)));
      if (selectedApiTest?.id === test.id) {
        setSelectedApiTest(res.test);
      }
    } catch (err: any) {
      console.error('Run failed:', err);
    } finally {
      setRunningTestId(null);
    }
  };

  // API Testing: Save Test (Create or Update)
  const handleSaveTestClick = () => {
    setIsSaveModalOpen(true);
  };

  const handleSaveTestSubmit = async (name: string) => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const payload = {
        name,
        method: builderMethod,
        url: builderUrl.trim(),
        queryParams: builderQueryParams.filter((p) => p.key.trim() && p.enabled !== false),
        headers: builderHeaders.filter((h) => h.key.trim() && h.enabled !== false),
        requestBody: builderRequestBody.trim() ? builderRequestBody : null,
        authenticationType: builderAuthType,
        authenticationConfig: builderAuthType !== 'NONE' && (builderAuthConfig.token || builderAuthConfig.username || builderAuthConfig.key)
          ? builderAuthConfig
          : undefined,
        timeoutMs: 15000,
        expectedStatusCode: builderExpectedStatusCode,
        expectedResponse: builderAssertions.filter((a) => a.field.trim()),
        maxResponseTime: builderMaxResponseTime,
      };

      if (selectedApiTest) {
        const updated = await apiTestingService.updateApiTest(selectedApiTest.id, payload);
        setSelectedApiTest(updated);
        setApiTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await apiTestingService.createApiTest(projectId, payload);
        setSelectedApiTest(created);
        setApiTests((prev) => [created, ...prev]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // API Testing: Delete Test
  const handleDeleteApiTest = async (test: ApiTest) => {
    if (!window.confirm(`Are you sure you want to delete "${test.name}"?`)) return;
    try {
      await apiTestingService.deleteApiTest(test.id);
      setApiTests((prev) => prev.filter((t) => t.id !== test.id));
      if (selectedApiTest?.id === test.id) {
        handleNewApiTest();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete test');
    }
  };

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      const matchesSearch =
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMethod =
        selectedMethod === 'ALL' || ep.method === selectedMethod;
      return matchesSearch && matchesMethod;
    });
  }, [endpoints, searchQuery, selectedMethod]);

  if (isLoading && !project) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm font-mono">Loading project endpoints...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="py-12 max-w-xl mx-auto px-4">
        <div className="p-6 bg-slate-900 border border-rose-500/30 rounded-xl text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <h3 className="text-lg font-semibold text-white">Project Not Found</h3>
          <p className="text-xs text-slate-400">{error}</p>
          <div className="pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
        <Link to="/dashboard" className="hover:text-slate-200 transition-colors">
          Workspaces
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
        {workspace ? (
          <Link
            to={`/workspaces/${workspace.id}`}
            className="hover:text-slate-200 transition-colors truncate max-w-[150px]"
          >
            {workspace.name}
          </Link>
        ) : (
          <span>Workspace</span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
        <span className="text-slate-200 font-semibold truncate max-w-[200px]">
          {project?.name}
        </span>
      </nav>

      {/* Project Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <FolderKanban className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {project?.name}
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {endpoints.length} {endpoints.length === 1 ? 'Endpoint' : 'Endpoints'}
                </span>
                {apiTests.length > 0 && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {apiTests.length} {apiTests.length === 1 ? 'API Test' : 'API Tests'}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {project?.description || 'No description configured for this project.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-center">
            <button
              onClick={() => {
                loadData();
                if (activeTab === 'analytics') {
                  loadAnalytics(timeRange);
                  loadRequests(requestFilterParams);
                } else if (activeTab === 'api-testing') {
                  loadApiTests();
                }
              }}
              disabled={isLoading || isAnalyticsLoading || isRequestsLoading || isApiTestsLoading}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
              title="Refresh project details"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isLoading || isAnalyticsLoading || isRequestsLoading || isApiTestsLoading
                    ? 'animate-spin'
                    : ''
                }`}
              />
            </button>
            {activeTab === 'endpoints' ? (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-indigo-600/20"
              >
                <Plus className="h-4 w-4" />
                <span>New Endpoint</span>
              </button>
            ) : activeTab === 'api-testing' ? (
              <button
                onClick={handleNewApiTest}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-indigo-600/20"
              >
                <Plus className="h-4 w-4" />
                <span>New API Test</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Mock Server Base URL Box */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-4 bg-slate-950/90 border border-indigo-950/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="p-2 bg-indigo-950/60 border border-indigo-800/60 rounded-lg text-indigo-400 flex-shrink-0">
                <Globe className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Mock Server Base URL
                </div>
                <div className="font-mono text-xs sm:text-sm font-semibold text-indigo-300 truncate mt-0.5">
                  {mockBaseUrl}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center">
              <button
                onClick={handleCopyBaseUrl}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition-colors border border-slate-700"
              >
                {copiedBaseUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied Base URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <span>Copy Base URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-2.5 flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
            <Terminal className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">
              Example request:{' '}
              <span className="text-slate-400">
                curl -i {mockBaseUrl}/your-endpoint-path
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="border-b border-slate-800 flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('endpoints')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === 'endpoints'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Mock Endpoints</span>
          <span className="ml-1 px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-xs">
            {endpoints.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === 'analytics'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Request History & Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('api-testing')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === 'api-testing'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-4 h-4 text-indigo-400" />
          <span>Real API Testing</span>
          {apiTests.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-indigo-950 text-indigo-300 rounded text-xs font-mono border border-indigo-800">
              {apiTests.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ENDPOINTS CONTENT */}
      {activeTab === 'endpoints' && (
        <div className="space-y-6">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by path or endpoint name..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Method Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors border ${
                    selectedMethod === m
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoints List */}
          {filteredEndpoints.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {filteredEndpoints.map((ep) => (
                <EndpointCard
                  key={ep.id}
                  endpoint={ep}
                  baseUrl={mockBaseUrl}
                  onEdit={(target) => setEditingEndpoint(target)}
                  onDelete={(target) => setDeletingEndpoint(target)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="p-3 bg-slate-800/80 rounded-2xl text-slate-400">
                <SlidersHorizontal className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {endpoints.length === 0 ? 'No Mock Endpoints Yet' : 'No Matching Endpoints'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  {endpoints.length === 0
                    ? 'Create simulated API endpoints to test custom HTTP responses, simulated delays, headers, and payload structures.'
                    : 'Try adjusting your search query or HTTP method filters.'}
                </p>
              </div>
              {endpoints.length === 0 && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Your First Endpoint</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REQUEST HISTORY & ANALYTICS CONTENT */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Performance Overview Stat Cards */}
          <AnalyticsOverview
            analytics={analytics}
            isLoading={isAnalyticsLoading}
          />

          {/* Interactive Volume Chart */}
          <RequestVolumeChart
            volumeData={analytics.volumeOverTime}
            timeRange={timeRange}
            onTimeRangeChange={(range) => setTimeRange(range)}
            isLoading={isAnalyticsLoading}
          />

          {/* Filterable Request History Table */}
          <RequestHistoryTable
            logs={requestLogs}
            pagination={requestPagination}
            filterParams={requestFilterParams}
            onFilterChange={(newParams) => {
              setRequestFilterParams((prev) => ({ ...prev, ...newParams }));
            }}
            onPageChange={(page) => {
              setRequestFilterParams((prev) => ({ ...prev, page }));
            }}
            onSelectLog={(log) => setSelectedLog(log)}
            onRefresh={() => {
              loadAnalytics(timeRange);
              loadRequests(requestFilterParams);
            }}
            isLoading={isRequestsLoading}
          />

          {/* Request Details Drawer */}
          <RequestDetailsDrawer
            log={selectedLog}
            isOpen={Boolean(selectedLog)}
            onClose={() => setSelectedLog(null)}
          />
        </div>
      )}

      {/* TAB 3: REAL API TESTING CONTENT */}
      {activeTab === 'api-testing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Real API Testing Engine</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Execute real requests with automated validation and diagnostic analysis</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDiagnosticsOverviewOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              <span>Diagnostics Overview</span>
            </button>
          </div>

          {/* Local Diagnostic Agent Status */}
          <AgentStatusCard
            agents={agents}
            onOpenPairModal={() => setIsPairModalOpen(true)}
            onRevokeAgent={handleRevokeAgent}
            isRevoking={isRevokingAgent}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Saved Tests List */}
            <div className="lg:col-span-4 xl:col-span-3">
              <SavedTestsList
                tests={apiTests}
                activeTestId={selectedApiTest?.id || null}
                onSelectTest={handleSelectApiTest}
                onRunTest={handleRunSavedTest}
                onViewHistory={(test) => setHistoryModalTest(test)}
                onDeleteTest={handleDeleteApiTest}
                onNewTest={handleNewApiTest}
                runningTestId={runningTestId}
                isLoading={isApiTestsLoading}
              />
            </div>

            {/* Right Column: Request Builder & Response Viewer */}
            <div className="lg:col-span-8 xl:col-span-9 space-y-6">
              <RequestBuilder
                method={builderMethod}
                setMethod={setBuilderMethod}
                url={builderUrl}
                setUrl={setBuilderUrl}
                queryParams={builderQueryParams}
                setQueryParams={setBuilderQueryParams}
                headers={builderHeaders}
                setHeaders={setBuilderHeaders}
                authType={builderAuthType}
                setAuthType={setBuilderAuthType}
                authConfig={builderAuthConfig}
                setAuthConfig={setBuilderAuthConfig}
                hasStoredCredentials={selectedApiTest?.hasCredentials}
                requestBody={builderRequestBody}
                setRequestBody={setBuilderRequestBody}
                expectedStatusCode={builderExpectedStatusCode}
                setExpectedStatusCode={setBuilderExpectedStatusCode}
                maxResponseTime={builderMaxResponseTime}
                setMaxResponseTime={setBuilderMaxResponseTime}
                assertions={builderAssertions}
                setAssertions={setBuilderAssertions}
                onSend={handleSendRequest}
                onSave={handleSaveTestClick}
                isSending={isSending}
                isSaving={isSaving}
                activeTestName={selectedApiTest?.name}
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgentId={setSelectedAgentId}
                onOpenPairModal={() => setIsPairModalOpen(true)}
              />

              <ResponseViewer run={currentRun} isLoading={isSending} diagnosticReport={currentRun?.diagnosticReport} />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EndpointModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateEndpoint}
      />

      <EndpointModal
        isOpen={Boolean(editingEndpoint)}
        onClose={() => setEditingEndpoint(null)}
        onSubmit={handleUpdateEndpoint}
        initialData={editingEndpoint}
      />

      <DeleteEndpointModal
        isOpen={Boolean(deletingEndpoint)}
        onClose={() => setDeletingEndpoint(null)}
        onConfirm={handleDeleteEndpoint}
        endpoint={deletingEndpoint}
      />

      {/* Real API Testing Modals */}
      <SaveTestModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveTestSubmit}
        initialName={selectedApiTest?.name || ''}
        isSaving={isSaving}
      />

      {historyModalTest && (
        <TestRunHistoryModal
          test={historyModalTest}
          onClose={() => setHistoryModalTest(null)}
        />
      )}

      {isDiagnosticsOverviewOpen && project && (
        <DiagnosticOverviewModal
          projectId={project.id}
          projectName={project.name}
          onClose={() => setIsDiagnosticsOverviewOpen(false)}
        />
      )}

      {projectId && (
        <AgentPairingModal
          projectId={projectId}
          isOpen={isPairModalOpen}
          onClose={() => setIsPairModalOpen(false)}
          onAgentConnected={() => loadAgents()}
        />
      )}
    </div>
  );
};
