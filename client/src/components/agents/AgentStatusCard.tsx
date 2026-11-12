import React from 'react';
import {
  Laptop,
  Radio,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import type { LocalAgent } from '../../types/agent';

interface AgentStatusCardProps {
  agents: LocalAgent[];
  onOpenPairModal: () => void;
  onRevokeAgent: (agentId: string) => void;
  isRevoking?: boolean;
}

export const AgentStatusCard: React.FC<AgentStatusCardProps> = ({
  agents,
  onOpenPairModal,
  onRevokeAgent,
  isRevoking,
}) => {
  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Local Diagnostic Agents</h3>
            <p className="text-xs text-muted-foreground">
              Test local APIs securely via outbound-only agent connection
            </p>
          </div>
        </div>
        <button
          onClick={onOpenPairModal}
          className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors border border-border flex items-center space-x-1.5"
        >
          <Laptop className="h-3.5 w-3.5 text-emerald-400" />
          <span>Pair Local Agent</span>
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-border bg-muted/20 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            No local agents connected. Connect an agent to test APIs running on your local machine.
          </p>
          <button
            onClick={onOpenPairModal}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center space-x-1"
          >
            <span>Click here to pair an agent</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {agents.map((agent) => {
            const isOnline = agent.status === 'ONLINE';
            const isRevoked = agent.status === 'REVOKED';

            return (
              <div
                key={agent.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isRevoked
                    ? 'border-red-950/40 bg-zinc-950/30 opacity-80'
                    : isOnline
                    ? 'border-border bg-background hover:border-emerald-500/30'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Laptop className="h-5 w-5 text-muted-foreground" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                        isOnline
                          ? 'bg-emerald-500 animate-pulse'
                          : isRevoked
                          ? 'bg-red-500'
                          : 'bg-zinc-500'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-sm font-medium ${
                          isRevoked ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {agent.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isRevoked
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center space-x-1 font-mono text-[11px] text-foreground">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                        <span>{agent.approvedOrigin}</span>
                      </span>
                      <span>•</span>
                      <span>
                        {isRevoked
                          ? 'Revoked'
                          : `Last active: ${formatLastSeen(agent.lastSeenAt)}`}
                      </span>
                      {agent.systemInfo?.hostname && (
                        <>
                          <span>•</span>
                          <span className="text-muted-foreground/80">
                            {agent.systemInfo.hostname}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!isRevoked ? (
                    <button
                      onClick={() => onRevokeAgent(agent.id)}
                      disabled={isRevoking}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-950/20 transition-colors disabled:opacity-50"
                      title="Revoke and disconnect agent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="flex items-center space-x-1 text-[11px] text-red-400/80 px-2 py-1 rounded bg-red-950/20 border border-red-900/30">
                      <ShieldAlert className="h-3 w-3" />
                      <span>Permanently Revoked</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
