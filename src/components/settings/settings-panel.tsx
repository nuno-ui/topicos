'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Trash2, Plus, Shield, Sparkles, BarChart3, Brain, Zap, X,
  Mail, MessageSquare, BookOpen, Download, Clock, AlertTriangle,
} from 'lucide-react';
import { SourceIcon } from '@/components/ui/source-icon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  googleAccounts: { id: string; email: string }[];
  slackAccounts: { id: string; team_name: string }[];
  notionAccounts: { id: string; workspace_name: string | null; workspace_icon: string | null }[];
  accountSyncMap: Record<string, string>; // account_id -> last item created_at ISO string
}

type AccountType = 'google' | 'slack' | 'notion';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns 'green' | 'amber' | 'red' based on how recent the last item is. */
function getAccountStatus(lastSyncAt: string | undefined): 'green' | 'amber' | 'red' {
  if (!lastSyncAt) return 'red';
  const daysSince = (Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 'green';
  if (daysSince <= 30) return 'amber';
  return 'red';
}

const statusDotColors: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  green: 'Active',
  amber: 'Stale',
  red: 'Inactive',
};

const statusLabelColors: Record<string, string> = {
  green: 'text-green-700 bg-green-50',
  amber: 'text-amber-700 bg-amber-50',
  red: 'text-red-700 bg-red-50',
};

function formatRelativeTime(isoDate: string | undefined): string {
  if (!isoDate) return 'Never';
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Status dot indicator component */
function StatusDot({ status }: { status: 'green' | 'amber' | 'red' }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === 'green' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusDotColors[status]}`} />
    </span>
  );
}

/** Section divider */
function SectionDivider() {
  return <div className="border-t border-gray-200" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsPanel({
  googleAccounts: initialGoogle,
  slackAccounts: initialSlack,
  notionAccounts: initialNotion,
  accountSyncMap,
}: Props) {
  const [googleAccounts, setGoogleAccounts] = useState(initialGoogle);
  const [slackAccounts, setSlackAccounts] = useState(initialSlack);
  const [notionAccounts, setNotionAccounts] = useState(initialNotion);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Inline disconnect confirmation state
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<{
    accountId: string;
    type: AccountType;
    label: string;
  } | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Agent state
  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [usageInsights, setUsageInsights] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<{ topics: number; items: number; aiRuns: number; totalTokens: number } | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [healthCheck, setHealthCheck] = useState<string | null>(null);
  const [showHealth, setShowHealth] = useState(false);
  const [optimizations, setOptimizations] = useState<string | null>(null);
  const [showOptimizations, setShowOptimizations] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState('');

  // Auto-cancel disconnect confirmation after 5 seconds
  useEffect(() => {
    if (confirmingDisconnect) {
      confirmTimerRef.current = setTimeout(() => {
        setConfirmingDisconnect(null);
      }, 5000);
      return () => {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      };
    }
  }, [confirmingDisconnect]);

  // ========== CONNECT HANDLERS ==========

  const connectGoogle = () => { window.location.href = '/api/auth/google/connect'; };
  const connectSlack = () => { window.location.href = '/api/auth/slack/connect'; };
  const connectNotion = () => { window.location.href = '/api/auth/notion/connect'; };

  // ========== UNIFIED DISCONNECT HANDLER (DRY) ==========

  const requestDisconnect = (type: AccountType, accountId: string, label: string) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDisconnect({ accountId, type, label });
  };

  const cancelDisconnect = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDisconnect(null);
  };

  const handleDisconnect = useCallback(async (type: AccountType, accountId: string) => {
    setConfirmingDisconnect(null);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setDisconnecting(accountId);
    try {
      const res = await fetch(`/api/auth/${type}/${accountId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      if (type === 'google') {
        setGoogleAccounts(prev => prev.filter(a => a.id !== accountId));
      } else if (type === 'slack') {
        setSlackAccounts(prev => prev.filter(a => a.id !== accountId));
      } else {
        setNotionAccounts(prev => prev.filter(a => a.id !== accountId));
      }
      toast.success('Account disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    }
    setDisconnecting(null);
  }, []);

  // ========== AI AGENT FUNCTIONS ==========

  const runUsageInsights = async () => {
    setAgentLoading('usage');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'usage_insights', context: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsageInsights(data.result.insights);
      setUsageStats(data.result.stats);
      setShowInsights(true);
      toast.success('Usage insights generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAgentLoading(null);
  };

  const runHealthCheck = async () => {
    setAgentLoading('health');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'health_check', context: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHealthCheck(data.result.health || data.result.insights || 'System is healthy');
      setShowHealth(true);
      toast.success('Health check complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Health check failed');
    }
    setAgentLoading(null);
  };

  const runOptimizations = async () => {
    setAgentLoading('optimize');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'optimization_suggestions', context: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOptimizations(data.result.suggestions || data.result.insights || 'No suggestions at this time');
      setShowOptimizations(true);
      toast.success('Optimization suggestions ready');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAgentLoading(null);
  };

  // ========== EXPORT DATA ==========

  const handleExportData = async () => {
    setExporting(true);
    try {
      setExportStep('topics');
      const topicsRes = await fetch('/api/topics');
      const topics = await topicsRes.json();

      setExportStep('items');
      const items: unknown[] = [];
      for (const t of (topics.topics || []).slice(0, 50)) {
        try {
          const res = await fetch(`/api/topics/${t.id}/items`);
          const data = await res.json();
          items.push(...(data.items || []));
        } catch { /* skip individual failures */ }
      }

      setExportStep('contacts');
      const contactsRes = await fetch('/api/contacts');
      const contacts = await contactsRes.json();

      setExportStep('ai runs');
      // Slight delay for UX feedback
      await new Promise(r => setTimeout(r, 200));

      const exportData = {
        exported_at: new Date().toISOString(),
        version: 'TopicOS v3',
        topics: topics.topics || [],
        contacts: contacts.contacts || [],
        items,
      };

      setExportStep('downloading');
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `topicos-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Export failed');
    }
    setExporting(false);
    setExportStep('');
  };

  // ========== MARKDOWN RENDERER ==========

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-sm">{line.replace('## ', '')}</h3>;
      if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-gray-900 mt-2 mb-1 text-base">{line.replace('# ', '')}</h2>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5">{line.slice(2)}</li>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-800 mt-2 text-sm">{line.replace(/\*\*/g, '')}</p>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm text-gray-700 mt-1">{line}</p>;
    });
  };

  // ========== INLINE DISCONNECT CONFIRMATION BAR ==========

  const renderConfirmBar = (accountId: string) => {
    if (!confirmingDisconnect || confirmingDisconnect.accountId !== accountId) return null;
    return (
      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3 animate-in slide-in-from-top-1">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Are you sure? This will remove all connected data.</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cancelDisconnect}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDisconnect(confirmingDisconnect.type, confirmingDisconnect.accountId)}
            disabled={disconnecting === accountId}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {disconnecting === accountId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Disconnect'}
          </button>
        </div>
      </div>
    );
  };

  // ========== RENDER ==========

  return (
    <div className="space-y-8">
      {/* AI Platform Assistants */}
      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Platform Assistants
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runUsageInsights} disabled={agentLoading !== null}
            className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
            {agentLoading === 'usage' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Usage Insights
          </button>
          <button onClick={runHealthCheck} disabled={agentLoading !== null}
            className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
            {agentLoading === 'health' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Health Check
          </button>
          <button onClick={runOptimizations} disabled={agentLoading !== null}
            className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
            {agentLoading === 'optimize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            Optimization Tips
          </button>
        </div>
      </div>

      {/* Usage Insights Panel */}
      {showInsights && usageInsights && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Usage Insights
            </h3>
            <button onClick={() => setShowInsights(false)} className="p-1 text-purple-400 hover:text-purple-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {usageStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                <p className="text-lg font-bold text-purple-600">{usageStats.topics}</p>
                <p className="text-xs text-gray-500">Topics</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                <p className="text-lg font-bold text-blue-600">{usageStats.items}</p>
                <p className="text-xs text-gray-500">Items</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                <p className="text-lg font-bold text-green-600">{usageStats.aiRuns}</p>
                <p className="text-xs text-gray-500">AI Runs</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                <p className="text-lg font-bold text-amber-600">{usageStats.totalTokens.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Tokens Used</p>
              </div>
            </div>
          )}
          <div className="prose prose-sm max-w-none">{renderMarkdown(usageInsights)}</div>
        </div>
      )}

      {/* Health Check Panel */}
      {showHealth && healthCheck && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <Zap className="w-4 h-4" /> System Health
            </h3>
            <button onClick={() => setShowHealth(false)} className="p-1 text-green-400 hover:text-green-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(healthCheck)}</div>
        </div>
      )}

      {/* Optimization Suggestions Panel */}
      {showOptimizations && optimizations && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Optimization Tips
            </h3>
            <button onClick={() => setShowOptimizations(false)} className="p-1 text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(optimizations)}</div>
        </div>
      )}

      <SectionDivider />

      {/* ============================================================ */}
      {/* Google Accounts                                               */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Mail className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900">Google Accounts</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 inline-flex items-center gap-1">
            <SourceIcon source="gmail" className="w-3.5 h-3.5" />
            <SourceIcon source="calendar" className="w-3.5 h-3.5" />
            <SourceIcon source="drive" className="w-3.5 h-3.5" />
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4 ml-7.5">Connect Google to search Gmail, Calendar, and Drive</p>
        {googleAccounts.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Google accounts connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your emails, events, and files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {googleAccounts.map((a) => {
              const status = getAccountStatus(accountSyncMap[a.id]);
              const lastSync = accountSyncMap[a.id];
              return (
                <div key={a.id}>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-medium">G</div>
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <StatusDot status={status} />
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.email}</p>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400 flex items-center gap-1"><SourceIcon source="gmail" className="w-3 h-3" /> Email</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1"><SourceIcon source="calendar" className="w-3 h-3" /> Calendar</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1"><SourceIcon source="drive" className="w-3 h-3" /> Drive</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last synced: {formatRelativeTime(lastSync)}
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${statusLabelColors[status]}`}>
                            {statusLabels[status]}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Connected
                      </span>
                      <button
                        onClick={() => requestDisconnect('google', a.id, a.email)}
                        disabled={disconnecting === a.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                        title="Disconnect"
                      >
                        {disconnecting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {renderConfirmBar(a.id)}
                </div>
              );
            })}
          </div>
        )}
        <button onClick={connectGoogle}
          className="mt-3 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Connect Google Account
        </button>

        {/* Scopes info */}
        {googleAccounts.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-medium text-blue-700 mb-1">Granted Permissions</p>
            <div className="flex gap-2 flex-wrap text-xs text-blue-600">
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">Read Gmail</span>
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">Read Calendar</span>
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">Read Drive</span>
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">User Email</span>
            </div>
          </div>
        )}
      </div>

      <SectionDivider />

      {/* ============================================================ */}
      {/* Slack Workspaces                                              */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <MessageSquare className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">Slack Workspaces</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 inline-flex items-center">
            <SourceIcon source="slack" className="w-3.5 h-3.5" />
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4 ml-7.5">Connect Slack to search messages across channels and DMs</p>
        {slackAccounts.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Slack workspaces connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your Slack messages</p>
          </div>
        ) : (
          <div className="space-y-2">
            {slackAccounts.map((a) => {
              const status = getAccountStatus(accountSyncMap[a.id]);
              const lastSync = accountSyncMap[a.id];
              return (
                <div key={a.id}>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">S</div>
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <StatusDot status={status} />
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.team_name}</p>
                        <span className="text-xs text-gray-400 flex items-center gap-1"><SourceIcon source="slack" className="w-3 h-3" /> Messages, channels, DMs</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last synced: {formatRelativeTime(lastSync)}
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${statusLabelColors[status]}`}>
                            {statusLabels[status]}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Connected
                      </span>
                      <button
                        onClick={() => requestDisconnect('slack', a.id, a.team_name)}
                        disabled={disconnecting === a.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                        title="Disconnect"
                      >
                        {disconnecting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {renderConfirmBar(a.id)}
                </div>
              );
            })}
          </div>
        )}
        <button onClick={connectSlack}
          className="mt-3 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Connect Slack Workspace
        </button>

        {slackAccounts.length > 0 && (
          <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-xs font-medium text-purple-700 mb-1">Granted Permissions</p>
            <div className="flex gap-2 flex-wrap text-xs text-purple-600">
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">Search Messages</span>
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">Read Channels</span>
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">Read DMs</span>
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">User Info</span>
            </div>
          </div>
        )}
      </div>

      <SectionDivider />

      {/* ============================================================ */}
      {/* Notion Workspaces                                             */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Notion Workspaces</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 inline-flex items-center">
            <SourceIcon source="notion" className="w-3.5 h-3.5" />
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4 ml-7.5">Connect Notion to search pages and databases linked to your topics</p>
        {notionAccounts.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Notion workspaces connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your Notion pages, databases, and wikis</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notionAccounts.map((a) => {
              const status = getAccountStatus(accountSyncMap[a.id]);
              const lastSync = accountSyncMap[a.id];
              return (
                <div key={a.id}>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium text-lg">
                          {a.workspace_icon || 'N'}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <StatusDot status={status} />
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.workspace_name || 'Notion Workspace'}</p>
                        <span className="text-xs text-gray-400 flex items-center gap-1"><SourceIcon source="notion" className="w-3 h-3" /> Pages, databases, wikis</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last synced: {formatRelativeTime(lastSync)}
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${statusLabelColors[status]}`}>
                            {statusLabels[status]}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Connected
                      </span>
                      <button
                        onClick={() => requestDisconnect('notion', a.id, a.workspace_name || 'Notion Workspace')}
                        disabled={disconnecting === a.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                        title="Disconnect"
                      >
                        {disconnecting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {renderConfirmBar(a.id)}
                </div>
              );
            })}
          </div>
        )}
        <button onClick={connectNotion}
          className="mt-3 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Connect Notion Workspace
        </button>

        {notionAccounts.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-1">Granted Permissions</p>
            <div className="flex gap-2 flex-wrap text-xs text-gray-600">
              <span className="px-2 py-0.5 bg-gray-100 rounded-full">Search Content</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full">Read Pages</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full">Read Databases</span>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="pt-4 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">About TopicOS</h2>
        <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">TopicOS v3</p>
              <p className="text-xs text-gray-500 mt-0.5">Search-first topic-centric productivity</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Powered by Claude AI</p>
              <p className="mt-0.5">Built with Next.js, Supabase, Tailwind</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" /> Your data stays private
            </span>
            <span className="flex items-center gap-1">
              <SourceIcon source="gmail" className="w-3 h-3" />
              <SourceIcon source="calendar" className="w-3 h-3" />
              <SourceIcon source="drive" className="w-3 h-3" />
              <SourceIcon source="slack" className="w-3 h-3" />
              <SourceIcon source="notion" className="w-3 h-3" />
              Multi-source search
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-4 border-t border-red-200">
        <h2 className="text-lg font-semibold text-red-600 mb-3">Danger Zone</h2>
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-900">Export Your Data</p>
              <p className="text-xs text-red-600/70 mt-0.5">Download all your topics, items, and contacts as JSON</p>
              {exporting && exportStep && (
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                  <span className="text-xs text-red-600 font-medium">
                    Exporting... ({exportStep})
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? 'Exporting...' : 'Export Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
