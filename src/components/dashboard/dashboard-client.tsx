'use client';

import { useState } from 'react';
import type { Topic, Task, GoogleAccount, SyncRun, Item, ItemSource, AgentRun } from '@/types/database';
import { cn } from '@/lib/utils';
import { useComposeStore } from '@/stores/compose-store';
import { useEventStore } from '@/stores/event-store';
import { toast } from 'sonner';
import {
  Zap,
  Clock,
  Inbox,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Mail,
  FileText,
  StickyNote,
  Brain,
  PlayCircle,
  MailPlus,
  CalendarPlus,
  Bot,
  Loader2,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { PasteIn } from './paste-in';

const AREA_COLORS: Record<string, string> = {
  personal: 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20',
  career: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
  work: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
};

const SOURCE_ICONS: Record<ItemSource, React.ElementType> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  manual: StickyNote,
};

const SOURCE_COLORS: Record<ItemSource, string> = {
  gmail: 'text-red-400',
  calendar: 'text-blue-400',
  drive: 'text-yellow-400',
  manual: 'text-emerald-400',
};

interface DashboardClientProps {
  topics: Topic[];
  tasks: Task[];
  accounts: Pick<GoogleAccount, 'id' | 'email' | 'last_sync_at'>[];
  recentSyncs: SyncRun[];
  untriagedCount: number;
  recentItems: Item[];
  agentRuns?: AgentRun[];
  upcomingEvents?: Item[];
}

export function DashboardClient({
  topics,
  tasks,
  accounts,
  recentSyncs,
  untriagedCount,
  recentItems,
  agentRuns = [],
  upcomingEvents = [],
}: DashboardClientProps) {
  const [syncing, setSyncing] = useState(false);
  const [curatorRunning, setCuratorRunning] = useState(false);
  const openCompose = useComposeStore((s) => s.openCompose);
  const openEvent = useEventStore((s) => s.openEvent);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        toast.success('Sync completed successfully');
      } else {
        toast.error('Sync failed');
      }
    } catch {
      toast.error('Network error during sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleRunCurator = async () => {
    setCuratorRunning(true);
    try {
      const res = await fetch('/api/agents/curator', { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const output = data.output_json ?? {};
        toast.success(
          `Curator: ${output.items_processed ?? 0} items processed, ${output.topics_created ?? 0} topics created`
        );
      } else {
        toast.error('Curator failed');
      }
    } catch {
      toast.error('Network error running curator');
    } finally {
      setCuratorRunning(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(Math.abs(diffMs) / (1000 * 60));
    const isFuture = diffMs < 0;

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return isFuture ? `in ${diffMins}m` : `${diffMins}m ago`;
    if (diffMins < 1440) return isFuture ? `in ${Math.floor(diffMins / 60)}h` : `${Math.floor(diffMins / 60)}h ago`;
    const diffDays = Math.floor(diffMins / 1440);
    if (diffDays < 7) return isFuture ? `in ${diffDays}d` : `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-primary/5 via-card to-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{greeting}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {topics.length} active topics · {untriagedCount} items need attention
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => openCompose()}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-red-500/30 hover:shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
            <MailPlus className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Compose</p>
            <p className="text-xs text-muted-foreground">New email</p>
          </div>
        </button>

        <button
          onClick={() => openEvent()}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-blue-500/30 hover:shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
            <CalendarPlus className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Event</p>
            <p className="text-xs text-muted-foreground">New calendar event</p>
          </div>
        </button>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-emerald-500/30 hover:shadow-sm disabled:opacity-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <RefreshCw className={cn('h-5 w-5 text-emerald-400', syncing && 'animate-spin')} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{syncing ? 'Syncing...' : 'Sync'}</p>
            <p className="text-xs text-muted-foreground">Pull latest data</p>
          </div>
        </button>

        <button
          onClick={handleRunCurator}
          disabled={curatorRunning}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-purple-500/30 hover:shadow-sm disabled:opacity-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
            {curatorRunning ? (
              <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
            ) : (
              <Brain className="h-5 w-5 text-purple-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{curatorRunning ? 'Running...' : 'Curator'}</p>
            <p className="text-xs text-muted-foreground">AI organize</p>
          </div>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Link href="/topics" className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" />
            Active Topics
          </div>
          <p className="mt-1 text-2xl font-bold">{topics.length}</p>
        </Link>
        <Link href="/inbox" className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-warning" />
            Pending Tasks
          </div>
          <p className="mt-1 text-2xl font-bold">{tasks.length}</p>
        </Link>
        <Link href="/inbox" className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20 group">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4 text-area-career" />
            Untriaged
          </div>
          <div className="flex items-center gap-2">
            <p className="mt-1 text-2xl font-bold">{untriagedCount}</p>
            {untriagedCount > 50 && (
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            )}
          </div>
        </Link>
        <Link href="/settings" className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 text-area-personal" />
            Accounts
          </div>
          <p className="mt-1 text-2xl font-bold">{accounts.length}</p>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column - 2/3 */}
        <div className="col-span-2 space-y-6">
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  Upcoming Events
                </h2>
              </div>
              <div className="space-y-2">
                {upcomingEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-blue-500/20"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <Calendar className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {event.url ? (
                          <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {event.title}
                          </a>
                        ) : event.title}
                      </p>
                      {event.snippet && (
                        <p className="truncate text-xs text-muted-foreground">{event.snippet}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-blue-400">
                      {formatRelativeTime(event.occurred_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Topics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-5 w-5 text-primary" />
                Active Topics
              </h2>
              <Link href="/topics" className="text-sm text-primary hover:underline">
                View all &rarr;
              </Link>
            </div>
            {topics.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                <p>No active topics yet.</p>
                <Link href="/topics" className="mt-2 inline-block text-primary hover:underline">
                  Create your first topic
                </Link>
              </div>
            ) : (
              topics.slice(0, 5).map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium capitalize', AREA_COLORS[topic.area])}>
                      {topic.area}
                    </span>
                    <span className="font-medium">{topic.title}</span>
                    {topic.urgency_score != null && topic.urgency_score >= 60 && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                        Urgent
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>

          {/* Recent Activity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <Link href="/inbox" className="text-sm text-primary hover:underline">
                View all in Inbox &rarr;
              </Link>
            </div>
            {recentItems.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                <p>No items synced yet.</p>
                <p className="mt-1 text-sm">Click &ldquo;Sync&rdquo; above to pull in your Gmail, Drive &amp; Calendar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentItems.slice(0, 8).map((item) => {
                  const SourceIcon = SOURCE_ICONS[item.source];
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/20"
                    >
                      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background', SOURCE_COLORS[item.source])}>
                        <SourceIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-sm font-medium text-foreground">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {item.title}
                                <ExternalLink className="ml-1 inline h-3 w-3 opacity-50" />
                              </a>
                            ) : item.title}
                          </h3>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.occurred_at)}</span>
                        </div>
                        {item.snippet && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.snippet}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column - 1/3 */}
        <div className="space-y-6">
          {/* Today List */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Today List</h2>
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                No pending tasks
              </div>
            ) : (
              tasks.slice(0, 7).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2 rounded-lg border border-border bg-card p-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.due_at && (
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(task.due_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Agent Activity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Bot className="h-5 w-5 text-purple-400" />
                Agent Activity
              </h2>
              <Link href="/agents" className="text-sm text-primary hover:underline">
                All &rarr;
              </Link>
            </div>
            {agentRuns.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                No agent runs yet
              </div>
            ) : (
              agentRuns.slice(0, 5).map((run) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const output = run.output_json as any;
                return (
                  <div key={run.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize text-foreground">
                        {run.agent_type.replace('_', ' ')}
                      </span>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                        run.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        run.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                        'bg-blue-500/10 text-blue-400'
                      )}>
                        {run.status}
                      </span>
                    </div>
                    {output && typeof output === 'object' && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {output.items_processed != null && `${output.items_processed} items`}
                        {output.topics_created != null && ` · ${output.topics_created} topics`}
                        {output.message && output.message}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatRelativeTime(run.started_at)}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Sync Status */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Sync Status</h2>
            {accounts.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                <p>No accounts connected</p>
                <Link href="/settings" className="mt-1 inline-block text-primary hover:underline">
                  Connect Google
                </Link>
              </div>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <span className="text-sm truncate">{acc.email}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {acc.last_sync_at
                      ? formatRelativeTime(acc.last_sync_at)
                      : 'Never'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Paste-In */}
      <PasteIn />
    </div>
  );
}
