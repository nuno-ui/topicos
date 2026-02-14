'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AgentRun } from '@/types/database';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Bot,
  Filter as FilterIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  PlayCircle,
  Zap,
  Brain,
  Mail,
  CalendarCheck,
  Users,
  FileBarChart,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const AGENT_INFO: Record<string, { label: string; icon: React.ElementType; description: string; color: string }> = {
  curator: {
    label: 'Curator',
    icon: Brain,
    description: 'Auto-organizes items into topics, extracts contacts, scores relevance',
    color: 'text-purple-400',
  },
  triage: {
    label: 'Triage',
    icon: FilterIcon,
    description: 'Scores all pending items for relevance (0-1)',
    color: 'text-blue-400',
  },
  follow_up: {
    label: 'Follow-up',
    icon: Mail,
    description: 'Detects unanswered emails and generates draft replies',
    color: 'text-red-400',
  },
  meeting_prep: {
    label: 'Meeting Prep',
    icon: CalendarCheck,
    description: 'Generates briefing docs for upcoming meetings',
    color: 'text-emerald-400',
  },
  weekly_review: {
    label: 'Weekly Review',
    icon: FileBarChart,
    description: 'Summarizes the week: progress, stalls, priorities',
    color: 'text-amber-400',
  },
  smart_compose: {
    label: 'Smart Compose',
    icon: MessageSquare,
    description: 'Drafts emails/agendas with full topic awareness',
    color: 'text-cyan-400',
  },
  contact_intelligence: {
    label: 'Contact Intel',
    icon: Users,
    description: 'Extracts and updates contact profiles from communications',
    color: 'text-pink-400',
  },
};

const STATUS_STYLES: Record<string, { icon: React.ElementType; className: string }> = {
  running: { icon: Loader2, className: 'text-blue-400 animate-spin' },
  completed: { icon: CheckCircle2, className: 'text-emerald-400' },
  failed: { icon: XCircle, className: 'text-red-400' },
};

interface AgentsClientProps {
  runs: AgentRun[];
}

export function AgentsClient({ runs }: AgentsClientProps) {
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const router = useRouter();

  const handleRunAgent = async (agentType: string) => {
    setRunningAgent(agentType);
    try {
      const endpoint = `/api/agents/${agentType.replace('_', '-')}`;
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      const info = AGENT_INFO[agentType];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = (data as any).output ?? (data as any).output_json ?? {};

      if (res.ok && data.success !== false) {
        const summary = output.items_processed != null
          ? `${output.items_processed} items processed, ${output.topics_created ?? 0} topics created`
          : output.message ?? 'completed';
        toast.success(`${info?.label ?? agentType}: ${summary}`);
        router.refresh();
      } else {
        toast.error(`${info?.label ?? agentType}: ${data.error || output.error || 'failed'}`);
      }
    } catch {
      toast.error(`Network error running ${agentType} agent`);
    } finally {
      setRunningAgent(null);
    }
  };

  const formatDuration = (startedAt: string, finishedAt: string | null) => {
    if (!finishedAt) return 'Running...';
    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">AI Agents</h1>
        <p className="text-sm text-muted-foreground">
          Your AI workforce — run agents manually or they trigger automatically after syncs
        </p>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(AGENT_INFO).map(([type, info]) => {
          const AgentIcon = info.icon;
          const isRunning = runningAgent === type;
          const lastRun = runs.find((r) => r.agent_type === type);

          return (
            <div
              key={type}
              className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/20"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-background', info.color)}>
                    <AgentIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{info.label}</h3>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </div>
              </div>

              {lastRun && (
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  {(() => {
                    const status = STATUS_STYLES[lastRun.status] ?? STATUS_STYLES.failed;
                    const StatusIcon = status.icon;
                    return (
                      <span className="flex items-center gap-1">
                        <StatusIcon className={cn('h-3.5 w-3.5', status.className)} />
                        {lastRun.status}
                      </span>
                    );
                  })()}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(lastRun.started_at)}
                  </span>
                  <span>{formatDuration(lastRun.started_at, lastRun.finished_at)}</span>
                  {lastRun.tokens_used > 0 && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {lastRun.tokens_used.toLocaleString()} tokens
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() => handleRunAgent(type)}
                disabled={isRunning}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Run Now
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Recent runs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Agent Runs</h2>
        {runs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            <Bot className="mx-auto mb-2 h-8 w-8" />
            <p>No agent runs yet. Click &quot;Run Now&quot; on any agent above to start.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.slice(0, 20).map((run) => {
              const info = AGENT_INFO[run.agent_type];
              const status = STATUS_STYLES[run.status] ?? STATUS_STYLES.failed;
              const StatusIcon = status.icon;
              const AgentIcon = info?.icon ?? Bot;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const output = run.output_json as any;

              const isExpanded = expandedRun === run.id;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const actions = run.actions_taken as any[];

              return (
                <div key={run.id} className="rounded-lg border border-border bg-card">
                  <button
                    onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                    className="flex w-full items-center gap-4 p-3 text-left"
                  >
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background', info?.color ?? 'text-zinc-400')}>
                      <AgentIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {info?.label ?? run.agent_type}
                        </span>
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                          {run.trigger}
                        </span>
                      </div>
                      {output && typeof output === 'object' && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {output.items_processed != null && `${output.items_processed} items processed`}
                          {output.topics_created != null && ` · ${output.topics_created} topics created`}
                          {output.contacts_found != null && ` · ${output.contacts_found} contacts`}
                          {output.message && output.message}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <StatusIcon className={cn('h-3.5 w-3.5', status.className)} />
                      </span>
                      <span>{formatDuration(run.started_at, run.finished_at)}</span>
                      <span>{formatDate(run.started_at)}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {/* Expandable detail panel */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3">
                      {/* Output summary */}
                      {output && typeof output === 'object' && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Output</h4>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {Object.entries(output).map(([key, value]) => (
                              <div key={key} className="rounded-md bg-background px-3 py-2">
                                <p className="text-xs text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                                <p className="text-sm font-medium text-foreground">
                                  {typeof value === 'string' ? value : String(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions taken */}
                      {actions && Array.isArray(actions) && actions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">
                            Actions ({actions.length})
                          </h4>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {actions.slice(0, 20).map((action, i) => (
                              <div key={i} className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-xs">
                                <span className="font-medium text-foreground">{action.action}</span>
                                <span className="text-muted-foreground truncate">{action.description}</span>
                              </div>
                            ))}
                            {actions.length > 20 && (
                              <p className="text-xs text-muted-foreground px-3">
                                +{actions.length - 20} more actions
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tokens used */}
                      {run.tokens_used > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          {run.tokens_used.toLocaleString()} tokens used
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
