'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Trash2, Plus, Shield, Sparkles, BarChart3, Brain, Zap, X,
  Mail, MessageSquare, BookOpen, Download, Clock, AlertTriangle,
  Settings, Database, Upload, CheckCircle2, Info,
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

/** Status dot indicator component -- green has subtle glow, gray for disconnected */
function StatusDot({ status }: { status: 'green' | 'amber' | 'red' }) {
  return (
    <span className="relative flex h-3 w-3">
      {status === 'green' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${
        status === 'green' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' :
        status === 'amber' ? 'bg-amber-500' :
        'bg-gray-400'
      }`} />
    </span>
  );
}

/** Section header with icon and divider */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-gray-200 mb-4">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-gray-600" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
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
  const [exportProgress, setExportProgress] = useState(0);

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
    setExportProgress(0);
    try {
      setExportStep('topics');
      setExportProgress(15);
      const topicsRes = await fetch('/api/topics');
      const topics = await topicsRes.json();

      setExportStep('items');
      setExportProgress(35);
      const items: unknown[] = [];
      for (const t of (topics.topics || []).slice(0, 50)) {
        try {
          const res = await fetch(`/api/topics/${t.id}/items`);
          const data = await res.json();
          items.push(...(data.items || []));
        } catch { /* skip individual failures */ }
      }

      setExportStep('contacts');
      setExportProgress(65);
      const contactsRes = await fetch('/api/contacts');
      const contacts = await contactsRes.json();

      setExportStep('finalizing');
      setExportProgress(85);
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
      setExportProgress(100);
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
    setExportProgress(0);
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
      <div className="mt-2 p-4 bg-gradient-to-r from-red-50 to-red-100/50 border-l-4 border-l-red-500 border border-red-200 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-2.5 text-sm text-red-700">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="font-medium">Disconnect {confirmingDisconnect.label}?</p>
            <p className="text-xs text-red-500 mt-0.5">This will remove all connected data and cannot be undone.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cancelDisconnect}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDisconnect(confirmingDisconnect.type, confirmingDisconnect.accountId)}
            disabled={disconnecting === accountId}
            className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
          >
            {disconnecting === accountId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Confirm Disconnect
          </button>
        </div>
      </div>
    );
  };

  // ========== RENDER ==========

  return (
    <div className="space-y-8">
      {/* AI Platform Assistants -- gradient background with icons */}
      <div>
        <SectionHeader icon={Sparkles} title="AI Platform Assistants" subtitle="AI-powered insights about your workspace" />
        <div className="p-5 bg-gradient-to-br from-purple-50/80 via-white to-blue-50/80 rounded-xl border border-purple-100 shadow-sm">
          <div className="flex gap-2 flex-wrap">
            <button onClick={runUsageInsights} disabled={agentLoading !== null}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
              {agentLoading === 'usage' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
              Usage Insights
            </button>
            <button onClick={runHealthCheck} disabled={agentLoading !== null}
              className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-xs font-semibold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
              {agentLoading === 'health' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Health Check
            </button>
            <button onClick={runOptimizations} disabled={agentLoading !== null}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
              {agentLoading === 'optimize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              Optimization Tips
            </button>
          </div>
        </div>
      </div>

      {/* Usage Insights Panel */}
      {showInsights && usageInsights && (
        <div className="p-5 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-200 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </div>
              Usage Insights
            </h3>
            <button onClick={() => setShowInsights(false)} className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {usageStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-xl p-3.5 text-center border border-purple-100 hover-lift">
                <p className="text-2xl font-bold text-purple-600">{usageStats.topics}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">Topics</p>
              </div>
              <div className="bg-white rounded-xl p-3.5 text-center border border-blue-100 hover-lift">
                <p className="text-2xl font-bold text-blue-600">{usageStats.items}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">Items</p>
              </div>
              <div className="bg-white rounded-xl p-3.5 text-center border border-green-100 hover-lift">
                <p className="text-2xl font-bold text-green-600">{usageStats.aiRuns}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">AI Runs</p>
              </div>
              <div className="bg-white rounded-xl p-3.5 text-center border border-amber-100 hover-lift">
                <p className="text-2xl font-bold text-amber-600">{usageStats.totalTokens.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">Tokens Used</p>
              </div>
            </div>
          )}
          <div className="prose prose-sm max-w-none">{renderMarkdown(usageInsights)}</div>
        </div>
      )}

      {/* Health Check Panel */}
      {showHealth && healthCheck && (
        <div className="p-5 bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              System Health
            </h3>
            <button onClick={() => setShowHealth(false)} className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(healthCheck)}</div>
        </div>
      )}

      {/* Optimization Suggestions Panel */}
      {showOptimizations && optimizations && (
        <div className="p-5 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              Optimization Tips
            </h3>
            <button onClick={() => setShowOptimizations(false)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(optimizations)}</div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Google Accounts                                               */}
      {/* ============================================================ */}
      <div>
        <SectionHeader
          icon={Mail}
          title="Google Accounts"
          subtitle="Connect Google to search Gmail, Calendar, and Drive"
        />
        {googleAccounts.length === 0 ? (
          <div className="p-8 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">No Google accounts connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your emails, events, and files</p>
          </div>
        ) : (
          <div className="space-y-3">
            {googleAccounts.map((a) => {
              const status = getAccountStatus(accountSyncMap[a.id]);
              const lastSync = accountSyncMap[a.id];
              return (
                <div key={a.id}>
                  <div className="p-4 bg-white rounded-xl border-l-4 border-l-red-500 border border-gray-100 shadow-sm hover-lift">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-red-600" />
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <StatusDot status={status} />
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{a.email}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400 flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded">
                              <SourceIcon source="gmail" className="w-3 h-3" /> Email
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded">
                              <SourceIcon source="calendar" className="w-3 h-3" /> Calendar
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded">
                              <SourceIcon source="drive" className="w-3 h-3" /> Drive
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
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
                        <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                          status === 'green'
                            ? 'text-green-700 bg-green-50 border border-green-200'
                            : 'text-gray-600 bg-gray-50 border border-gray-200'
                        }`}>
                          {status === 'green' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          Connected
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
                  </div>
                  {renderConfirmBar(a.id)}
                </div>
              );
            })}
          </div>
        )}
        <button onClick={connectGoogle}
          className="mt-3 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-semibold hover:from-red-600 hover:to-red-700 flex items-center gap-2 transition-all shadow-sm hover:shadow-md">
          <Plus className="w-4 h-4" /> Connect Google Account
        </button>

        {/* Scopes info */}
        {googleAccounts.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            <p className="text-xs font-medium text-blue-700 mb-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" /> Granted Permissions
            </p>
            <div className="flex gap-2 flex-wrap text-xs text-blue-600">
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">Read Gmail</span>
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">Read Calendar</span>
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">Read Drive</span>
              <span className="px-2 py-0.5 bg-blue-100 rounded-full">User Email</span>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Slack Workspaces                                              */}
      {/* ============================================================ */}
      <div>
        <SectionHeader
          icon={MessageSquare}
          title="Slack Workspaces"
          subtitle="Connect Slack to search messages across channels and DMs"
        />
        {slackAccounts.length === 0 ? (
          <div className="p-8 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-purple-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">No Slack workspaces connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your Slack messages</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slackAccounts.map((a) => {
              const status = getAccountStatus(accountSyncMap[a.id]);
              const lastSync = accountSyncMap[a.id];
              return (
                <div key={a.id}>
                  <div className="p-4 bg-white rounded-xl border-l-4 border-l-purple-500 border border-gray-100 shadow-sm hover-lift">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-purple-600" />
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <StatusDot status={status} />
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{a.team_name}</p>
                          <span className="text-xs text-gray-400 flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded mt-1 inline-flex">
                            <SourceIcon source="slack" className="w-3 h-3" /> Messages, channels, DMs
                          </span>
                          <div className="flex items-center gap-2 mt-1.5">
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
                        <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                          status === 'green'
                            ? 'text-green-700 bg-green-50 border border-green-200'
                            : 'text-gray-600 bg-gray-50 border border-gray-200'
                        }`}>
                          {status === 'green' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          Connected
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
                  </div>
                  {renderConfirmBar(a.id)}
                </div>
              );
            })}
          </div>
        )}
        <button onClick={connectSlack}
          className="mt-3 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-purple-600 hover:to-purple-700 flex items-center gap-2 transition-all shadow-sm hover:shadow-md">
          <Plus className="w-4 h-4" /> Connect Slack Workspace
        </button>

        {slackAccounts.length > 0 && (
          <div className="mt-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
            <p className="text-xs font-medium text-purple-700 mb-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" /> Granted Permissions
            </p>
            <div className="flex gap-2 flex-wrap text-xs text-purple-600">
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">Search Messages</span>
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">Read Channels</span>
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">Read DMs</span>
              <span className="px-2 py-0.5 bg-purple-100 rounded-full">User Info</span>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Notion Workspaces                                             */}
      {/* ============================================================ */}
      <div>
        <SectionHeader
          icon={BookOpen}
          title="Notion Workspaces"
          subtitle="Connect Notion to search pages and databases linked to your topics"
        />
        {notionAccounts.length === 0 ? (
          <div className="p-8 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">No Notion workspaces connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your Notion pages, databases, and wikis</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notionAccounts.map((a) => {
              const status = getAccountStatus(accountSyncMap[a.id]);
              const lastSync = accountSyncMap[a.id];
              return (
                <div key={a.id}>
                  <div className="p-4 bg-white rounded-xl border-l-4 border-l-gray-700 border border-gray-100 shadow-sm hover-lift">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-lg">
                            {a.workspace_icon || 'N'}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <StatusDot status={status} />
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{a.workspace_name || 'Notion Workspace'}</p>
                          <span className="text-xs text-gray-400 flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded mt-1 inline-flex">
                            <SourceIcon source="notion" className="w-3 h-3" /> Pages, databases, wikis
                          </span>
                          <div className="flex items-center gap-2 mt-1.5">
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
                        <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                          status === 'green'
                            ? 'text-green-700 bg-green-50 border border-green-200'
                            : 'text-gray-600 bg-gray-50 border border-gray-200'
                        }`}>
                          {status === 'green' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          Connected
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
                  </div>
                  {renderConfirmBar(a.id)}
                </div>
              );
            })}
          </div>
        )}
        <button onClick={connectNotion}
          className="mt-3 px-5 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl text-sm font-semibold hover:from-gray-900 hover:to-black flex items-center gap-2 transition-all shadow-sm hover:shadow-md">
          <Plus className="w-4 h-4" /> Connect Notion Workspace
        </button>

        {notionAccounts.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50/50 rounded-xl border border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" /> Granted Permissions
            </p>
            <div className="flex gap-2 flex-wrap text-xs text-gray-600">
              <span className="px-2 py-0.5 bg-gray-100 rounded-full">Search Content</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full">Read Pages</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full">Read Databases</span>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Data Management                                               */}
      {/* ============================================================ */}
      <div>
        <SectionHeader
          icon={Database}
          title="Data Management"
          subtitle="Export your data or manage your workspace"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export */}
          <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover-lift">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Export Data</p>
                <p className="text-xs text-gray-500 mt-0.5">Download all your topics, items, and contacts as JSON</p>
                {exporting && exportStep && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-blue-600 font-medium capitalize">{exportStep}...</span>
                      <span className="text-xs text-gray-400">{exportProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleExportData}
                  disabled={exporting}
                  className="mt-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
                >
                  {exporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {exporting ? 'Exporting...' : 'Export Data'}
                </button>
              </div>
            </div>
          </div>

          {/* Import placeholder */}
          <div className="p-5 bg-white rounded-xl border border-gray-200 border-dashed shadow-sm opacity-60">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">Import Data</p>
                <p className="text-xs text-gray-400 mt-0.5">Import data from a previously exported file</p>
                <button
                  disabled
                  className="mt-3 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* About                                                         */}
      {/* ============================================================ */}
      <div>
        <SectionHeader icon={Settings} title="About TopicOS" />
        <div className="p-5 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">TopicOS v3</p>
              <p className="text-xs text-gray-500 mt-0.5">Search-first topic-centric productivity</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Powered by Claude AI</p>
              <p className="mt-0.5">Built with Next.js, Supabase, Tailwind</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
              <Shield className="w-3 h-3" /> Your data stays private
            </span>
            <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
              <SourceIcon source="gmail" className="w-3 h-3" />
              <SourceIcon source="calendar" className="w-3 h-3" />
              <SourceIcon source="drive" className="w-3 h-3" />
              <SourceIcon source="slack" className="w-3 h-3" />
              <SourceIcon source="notion" className="w-3 h-3" />
              Multi-source
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
