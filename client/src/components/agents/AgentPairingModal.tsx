import React, { useState, useEffect } from 'react';
import {
  X,
  Laptop,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Terminal,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { agentService } from '../../services/agentService';
import type { PairingSessionResponse } from '../../types/agent';

interface AgentPairingModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onAgentConnected?: () => void;
}

export const AgentPairingModal: React.FC<AgentPairingModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onAgentConnected,
}) => {
  const [approvedOrigin, setApprovedOrigin] = useState('http://localhost:5000');
  const [agentName, setAgentName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PairingSessionResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);

  // Reset modal state when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setSession(null);
      setError(null);
      setIsGenerating(false);
      setIsWaitingForAgent(false);
      setIsAgentConnected(false);
      setSecondsRemaining(600);
    }
  }, [isOpen]);

  // Countdown timer for pairing code expiration
  useEffect(() => {
    if (!session?.expiresAt) return;
    const expiresAtMs = new Date(session.expiresAt).getTime();

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const isExpired = Boolean(session && secondsRemaining <= 0);

  // Poll for agent coming online
  useEffect(() => {
    if (!isWaitingForAgent || !session || isAgentConnected || isExpired) return;

    const interval = setInterval(async () => {
      try {
        const agents = await agentService.listAgents(projectId);
        if (Array.isArray(agents)) {
          const targetOrigin = session.approvedOrigin.replace(/\/+$/, '');
          const onlineAgent = agents.find((a) => {
            const agentOrigin = (a.approvedOrigin || '').replace(/\/+$/, '');
            return (
              a.status === 'ONLINE' &&
              (agentOrigin === targetOrigin ||
                (targetOrigin.includes('localhost') && agentOrigin.includes('127.0.0.1')) ||
                (targetOrigin.includes('127.0.0.1') && agentOrigin.includes('localhost')))
            );
          });

          if (onlineAgent) {
            setIsWaitingForAgent(false);
            setIsAgentConnected(true);
            if (onAgentConnected) onAgentConnected();
          }
        }
      } catch {
        // Silently continue polling on transient network/abort errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isWaitingForAgent, session, isAgentConnected, isExpired, projectId, onAgentConnected]);

  if (!isOpen) return null;

  const handleGeneratePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;

    const trimmedOrigin = approvedOrigin.trim();
    if (!trimmedOrigin) {
      setError('Please provide an approved local origin.');
      return;
    }

    try {
      new URL(trimmedOrigin);
    } catch {
      setError('Approved origin must be a valid URL (e.g. http://localhost:5000)');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const res = await agentService.requestPairing(projectId, {
        approvedOrigin: trimmedOrigin,
        agentName: agentName.trim() || undefined,
      });

      if (!res || !res.pairingCode) {
        throw new Error('Server returned an empty or invalid pairing session.');
      }

      setSession(res);
      setIsWaitingForAgent(true);
      setIsAgentConnected(false);
    } catch (err: any) {
      const errMsg =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to generate pairing code';
      setError(errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetSession = () => {
    setSession(null);
    setIsWaitingForAgent(false);
    setIsAgentConnected(false);
    setSecondsRemaining(600);
    setError(null);
  };

  const copyToClipboard = async (text: string, type: 'code' | 'cmd') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedCmd(true);
        setTimeout(() => setCopiedCmd(false), 2000);
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  // Determine display command
  const rawCommand =
    session?.connectCommand ||
    session?.instructions ||
    (session ? `node packages/faultlab-agent/dist/cli.js connect --code ${session.pairingCode} --server ${window.location.origin} --origin ${session.approvedOrigin}` : '');
  const commandToDisplay = rawCommand.replace(/^Run in your local terminal:\s*/i, '').trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Connect Local Diagnostic Agent</h2>
              <p className="text-xs text-muted-foreground">
                Outbound-only secure bridge for localhost API testing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start space-x-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!session ? (
            <form onSubmit={handleGeneratePairingCode} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Approved Local Origin <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={approvedOrigin}
                  onChange={(e) => setApprovedOrigin(e.target.value)}
                  placeholder="http://localhost:5000"
                  disabled={isGenerating}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The local agent strictly validates target URLs. Only requests matching this origin will be allowed to execute.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Agent Device Label <span className="text-xs text-muted-foreground">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Workstation or Dev Laptop"
                  disabled={isGenerating}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Zero-Inbound Security Guarantee</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The FaultLab Agent does NOT open any ports on your local machine. It uses authenticated outbound HTTPS polling to fetch and report diagnostic results.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isGenerating}
                  className="px-4 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{isGenerating ? 'Generating Pairing Code...' : 'Generate Pairing Code'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Approved Origin Badge */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border bg-muted/20 text-xs">
                <div className="flex items-center space-x-2 text-muted-foreground font-medium">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  <span>Approved Local Origin:</span>
                </div>
                <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {session.approvedOrigin}
                </span>
              </div>

              {/* Pairing Code Card */}
              <div
                className={`p-4 rounded-xl border text-center space-y-2 transition-colors ${
                  isExpired
                    ? 'border-red-500/30 bg-red-950/20'
                    : 'border-emerald-500/30 bg-emerald-950/20'
                }`}
              >
                <div
                  className={`text-xs font-medium uppercase tracking-wider ${
                    isExpired ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {isExpired ? 'Pairing Code Expired' : 'Single-Use Pairing Code'}
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <span
                    className={`font-mono text-2xl font-bold tracking-widest selection:bg-emerald-500/30 ${
                      isExpired ? 'text-zinc-500 line-through' : 'text-white'
                    }`}
                  >
                    {session.pairingCode}
                  </span>
                  {!isExpired && (
                    <button
                      onClick={() => copyToClipboard(session.pairingCode, 'code')}
                      className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                      title="Copy pairing code"
                    >
                      {copiedCode ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center space-x-1.5 text-xs">
                  {isExpired ? (
                    <div className="flex items-center space-x-1.5 text-red-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Code has expired (10m TTL). Please generate a new code.</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Expires in{' '}
                        <span className="font-mono font-medium text-foreground">
                          {formatTime(secondsRemaining)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Terminal Command */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center space-x-1.5">
                    <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Run this command on your machine:</span>
                  </label>
                  {copiedCmd && (
                    <span className="text-[11px] font-medium text-emerald-400 animate-in fade-in">
                      Copied command to clipboard!
                    </span>
                  )}
                </div>
                <div className="relative group">
                  <pre className="p-3 text-xs font-mono bg-background border border-border rounded-lg overflow-x-auto text-emerald-400 pr-12">
                    {commandToDisplay}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(commandToDisplay, 'cmd')}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/50"
                    title="Copy CLI command"
                  >
                    {copiedCmd ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Live Connection Status & Expiration Actions */}
              <div className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between">
                {isAgentConnected ? (
                  <div className="flex items-center space-x-2 text-sm text-emerald-400 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Agent connected and online!</span>
                  </div>
                ) : isExpired ? (
                  <div className="flex items-center space-x-2 text-sm text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Pairing session expired.</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span>Waiting for agent to pair from your terminal...</span>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  {isExpired && (
                    <button
                      type="button"
                      onClick={handleResetSession}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors flex items-center space-x-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Generate New Code</span>
                    </button>
                  )}
                  {isAgentConnected && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
