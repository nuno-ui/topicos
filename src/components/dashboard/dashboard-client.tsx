'use client';

import { useState } from 'react';
import type { Topic, Task, GoogleAccount, SyncRun } from '@/types/database';
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
} from 'lucide-react';
import Link from 'next/link';
import { PasteIn } from './paste-in';

const AREA_COLORS = {
  personal: 'bg-area-personal/10 text-area-personal border-area-personal/20',
  career: 'bg-area-career/10 text-area-career border-area-career/20',
  work: 'bg-area-work/10 text-area-work border-area-work/20',
};

interface DashboardClientProps {
  topics: Topic[];
  tasks: Task[];
  accounts: Pick<GoogleAccount, 'id' | 'email' | 'last_sync_at'>[];
  recentSyncs: SyncRun[];
  untriagedCount: number;
}

export function DashboardClient({
  topics,
  tasks,
  accounts,
  recentSyncs,
  untriagedCount,
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
