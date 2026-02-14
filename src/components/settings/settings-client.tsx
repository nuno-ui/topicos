'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, GoogleAccount, SyncRun, SlackAccount } from '@/types/database';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Mail,
  RefreshCw,
  Trash2,
  ExternalLink,
  Settings,
  Shield,
  MessageSquare,
} from 'lucide-react';

interface SettingsClientProps {
  profile: Profile | null;
  googleAccounts: GoogleAccount[];
  recentSyncs: SyncRun[];
  slackAccounts: SlackAccount[];
}

const SYNC_STATUS_STYLES: Record<string, string> = {
  running: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export function SettingsClient({
  profile,
  googleAccounts,
  recentSyncs,
  slackAccounts,
}: SettingsClientProps) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null);
  const [indexingDepth, setIndexingDepth] = useState<'light' | 'medium' | 'full'>('medium');
  const [disconnectingSlack, setDisconnectingSlack] = useState<string | null>(null);
  const router = useRouter();

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId);
    try {
      const res = await fetch(`/api/auth/google/${accountId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Account disconnected');
        router.refresh();
      } else {
        toast.error('Failed to disconnect account');
      }
    } catch {
      toast.error('Network error disconnecting account');
    } finally {
      setDisconnecting(null);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncingAccount(accountId);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (res.ok) {
        toast.success('Sync completed successfully');
        router.refresh();
      } else {
        toast.error('Sync failed');
      }
    } catch {
      toast.error('Network error during sync');
    } finally {
      setSyncingAccount(null);
    }
  };

  const handleDisconnectSlack = async (accountId: string) => {
    setDisconnectingSlack(accountId);
    try {
      const res = await fetch(`/api/auth/slack/${accountId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Slack workspace disconnected');
        router.refresh();
      } else {
        toast.error('Failed to disconnect Slack');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDisconnectingSlack(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage connected accounts, sync controls, and preferences
        </p>
      </div>

      {/* Connected Accounts */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
        </div>

        {googleAccounts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No Google accounts connected yet.
            </p>
            <a
              href="/api/auth/google/connect"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              Connect Google Account
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {googleAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{account.email}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Scopes: {account.scopes.join(', ')}
                      </span>
                      <span>
                        {account.last_sync_at
                          ? `Last synced ${new Date(account.last_sync_at).toLocaleString()}`
                          : 'Never synced'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(account.id)}
                    disabled={syncingAccount === account.id}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn(
                        'h-3.5 w-3.5',
                        syncingAccount === account.id && 'animate-spin'
                      )}
                    />
                    {syncingAccount === account.id ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={() => handleDisconnect(account.id)}
                    disabled={disconnecting === account.id}
                    className="flex items-center gap-1.5 rounded-md border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {disconnecting === account.id ? 'Removing...' : 'Disconnect'}
                  </button>
                </div>
              </div>
            ))}

            <a
              href="/api/auth/google/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              Connect Another Account
            </a>
          </div>
        )}
      </section>

      {/* Slack Accounts */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Slack Workspaces</h2>
        </div>

        {slackAccounts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No Slack workspaces connected yet. Connect one to sync channel and DM messages.
            </p>
            <a
              href="/api/auth/slack/connect"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#4A154B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4A154B]/90"
            >
              <MessageSquare className="h-4 w-4" />
              Connect Slack Workspace
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {slackAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4A154B]/10">
                    <MessageSquare className="h-4 w-4 text-[#4A154B]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{account.team_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Team ID: {account.team_id}</span>
                      <span>
                        {account.last_sync_at
                          ? `Last synced ${new Date(account.last_sync_at).toLocaleString()}`
                          : 'Never synced'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDisconnectSlack(account.id)}
                    disabled={disconnectingSlack === account.id}
                    className="flex items-center gap-1.5 rounded-md border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {disconnectingSlack === account.id ? 'Removing...' : 'Disconnect'}
                  </button>
                </div>
              </div>
            ))}

            <a
              href="/api/auth/slack/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-[#4A154B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4A154B]/90"
            >
              <MessageSquare className="h-4 w-4" />
              Connect Another Workspace
            </a>
          </div>
        )}
      </section>

      {/* Sync Controls */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Sync Controls</h2>
        </div>

        {recentSyncs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No sync runs yet. Connect an account and trigger a sync to get started.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <div className="grid grid-cols-5 gap-4 border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Source</span>
              <span>Account</span>
              <span>Status</span>
              <span>Started</span>
              <span>Stats</span>
            </div>
            {recentSyncs.map((run) => {
              const account = googleAccounts.find((a) => a.id === run.account_id);
              return (
                <div
                  key={run.id}
                  className="grid grid-cols-5 gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="font-medium">{run.source}</span>
                  <span className="text-muted-foreground">
                    {account?.email ?? run.account_id.slice(0, 8)}
                  </span>
                  <span>
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                        SYNC_STATUS_STYLES[run.status] ?? ''
                      )}
                    >
                      {run.status}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">
                    {run.stats && Object.keys(run.stats).length > 0
                      ? Object.entries(run.stats)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')
                      : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Preferences */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Preferences</h2>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Indexing Depth</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Control how deeply TopicOS scans your connected sources. Higher depth means richer context but more processing.
            </p>
            <div className="flex gap-2">
              {(['light', 'medium', 'full'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setIndexingDepth(level)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors',
                    indexingDepth === level
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Preference saving coming soon.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
