'use client';

import { useState } from 'react';
import type { Topic, Task, GoogleAccount, SyncRun, Item, ItemSource } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  Zap,
  Clock,
  Inbox,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Mail,
  FileText,
  StickyNote,
} from 'lucide-react';
import Link from 'next/link';
import { PasteIn } from './paste-in';

const AREA_COLORS = {
  personal: 'bg-area-personal/10 text-area-personal border-area-personal/20',
  career: 'bg-area-career/10 text-area-career border-area-career/20',
  work: 'bg-area-work/10 text-area-work border-area-work/20',
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
}

export function DashboardClient({
  topics,
  tasks,
  accounts,
  recentSyncs,
  untriagedCount,
  recentItems,
}: DashboardClientProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      window.location.reload();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your command center — what matters now
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" />
            Active Topics
          </div>
          <p className="mt-1 text-2xl font-bold">{topics.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-warning" />
            Pending Tasks
          </div>
          <p className="mt-1 text-2xl font-bold">{tasks.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4 text-area-career" />
            Untriaged
          </div>
          <p className="mt-1 text-2xl font-bold">{untriagedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 text-area-personal" />
            Accounts
          </div>
          <p className="mt-1 text-2xl font-bold">{accounts.length}</p>
        </div>
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
            <p className="mt-1 text-sm">Click &ldquo;Sync Now&rdquo; to pull in your Gmail, Drive &amp; Calendar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentItems.map((item) => {
              const SourceIcon = SOURCE_ICONS[item.source];
              const date = new Date(item.occurred_at);
              const now = new Date();
              const diffMs = now.getTime() - date.getTime();
              const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
              const isFuture = diffMs < 0;
              const dateLabel = diffDays === 0 ? 'Today' : diffDays === 1 ? (isFuture ? 'Tomorrow' : 'Yesterday') : diffDays < 7 ? (isFuture ? `in ${diffDays}d` : `${diffDays}d ago`) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
                          </a>
                        ) : (
                          item.title
                        )}
                      </h3>
                      <span className="shrink-0 text-xs text-muted-foreground">{dateLabel}</span>
                    </div>
                    {item.snippet && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.snippet}</p>
                    )}
                  </div>
                  <span className={cn('mt-1 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize bg-background text-muted-foreground border-border')}>
                    {item.source}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Top Topics */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-lg font-semibold">Top Topics</h2>
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
                  <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', AREA_COLORS[topic.area])}>
                    {topic.area}
                  </span>
                  <span className="font-medium">{topic.title}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))
          )}
        </div>

        {/* Today List + Sync Status */}
        <div className="space-y-6">
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
                  <span className="text-sm">{acc.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {acc.last_sync_at
                      ? `Synced ${new Date(acc.last_sync_at).toLocaleString()}`
                      : 'Never synced'}
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
