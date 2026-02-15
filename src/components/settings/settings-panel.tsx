'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, Plus, Shield, Sparkles, BarChart3, Brain, Zap, X } from 'lucide-react';
import { sourceIcon } from '@/lib/utils';

interface Props {
  googleAccounts: { id: string; email: string }[];
  slackAccounts: { id: string; team_name: string }[];
  notionAccounts: { id: string; workspace_name: string | null; workspace_icon: string | null }[];
}

export function SettingsPanel({ googleAccounts: initialGoogle, slackAccounts: initialSlack, notionAccounts: initialNotion }: Props) {
  const [googleAccounts, setGoogleAccounts] = useState(initialGoogle);
  const [slackAccounts, setSlackAccounts] = useState(initialSlack);
  const [notionAccounts, setNotionAccounts] = useState(initialNotion);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // AI Agent state
  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [usageInsights, setUsageInsights] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<{ topics: number; items: number; aiRuns: number; totalTokens: number } | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [healthCheck, setHealthCheck] = useState<string | null>(null);
  const [showHealth, setShowHealth] = useState(false);
  const [optimizations, setOptimizations] = useState<string | null>(null);
  const [showOptimizations, setShowOptimizations] = useState(false);

  const connectGoogle = () => {
    window.location.href = '/api/auth/google/connect';
  };

  const connectSlack = () => {
    window.location.href = '/api/auth/slack/connect';
  };

  const connectNotion = () => {
    window.location.href = '/api/auth/notion/connect';
  };

  const disconnectGoogle = async (id: string, email: string) => {
    if (!confirm(`Disconnect Google account ${email}? This will remove search access to Gmail, Calendar, and Drive for this account.`)) return;
    setDisconnecting(id);
    try {
      const res = await fetch(`/api/auth/google/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setGoogleAccounts(prev => prev.filter(a => a.id !== id));
      toast.success(`Disconnected ${email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    }
    setDisconnecting(null);
  };

  const disconnectSlack = async (id: string, teamName: string) => {
    if (!confirm(`Disconnect Slack workspace ${teamName}? This will remove search access to this workspace's messages.`)) return;
    setDisconnecting(id);
    try {
      const res = await fetch(`/api/auth/slack/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setSlackAccounts(prev => prev.filter(a => a.id !== id));
      toast.success(`Disconnected ${teamName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    }
    setDisconnecting(null);
  };

  const disconnectNotion = async (id: string, workspaceName: string) => {
    if (!confirm(`Disconnect Notion workspace "${workspaceName}"? This will remove search access to pages and databases in this workspace.`)) return;
    setDisconnecting(id);
    try {
      const res = await fetch(`/api/auth/notion/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setNotionAccounts(prev => prev.filter(a => a.id !== id));
      toast.success(`Disconnected ${workspaceName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    }
    setDisconnecting(null);
  };

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

  return (
    <div className="space-y-8">
      {/* AI Platform Assistants */}
      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Platform Assistants
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runUsageInsights} disabled={!!agentLoading}
            className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5">
            {agentLoading === 'usage' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Usage Insights
          </button>
          <button onClick={runHealthCheck} disabled={!!agentLoading}
            className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 flex items-center gap-1.5">
            {agentLoading === 'health' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Health Check
          </button>
          <button onClick={runOptimizations} disabled={!!agentLoading}
            className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
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
            <div className="grid grid-cols-4 gap-3 mb-4">
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

      {/* Google Accounts */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Google Accounts</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
            {sourceIcon('gmail')} {sourceIcon('calendar')} {sourceIcon('drive')}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">Connect Google to search Gmail, Calendar, and Drive</p>
        {googleAccounts.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Google accounts connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your emails, events, and files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {googleAccounts.map((a) => (
              <div key={a.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-medium">G</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.email}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1">{sourceIcon('gmail')} Email</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">{sourceIcon('calendar')} Calendar</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">{sourceIcon('drive')} Drive</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Connected
                  </span>
                  <button
                    onClick={() => disconnectGoogle(a.id, a.email)}
                    disabled={disconnecting === a.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                    title="Disconnect"
                  >
                    {disconnecting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
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

      {/* Slack Workspaces */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Slack Workspaces</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
            {sourceIcon('slack')}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">Connect Slack to search messages across channels and DMs</p>
        {slackAccounts.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Slack workspaces connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your Slack messages</p>
          </div>
        ) : (
          <div className="space-y-2">
            {slackAccounts.map((a) => (
              <div key={a.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">S</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.team_name}</p>
                    <span className="text-xs text-gray-400 flex items-center gap-1">{sourceIcon('slack')} Messages, channels, DMs</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Connected
                  </span>
                  <button
                    onClick={() => disconnectSlack(a.id, a.team_name)}
                    disabled={disconnecting === a.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                    title="Disconnect"
                  >
                    {disconnecting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
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

      {/* Notion Workspaces */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Notion Workspaces</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {sourceIcon('notion')}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">Connect Notion to search pages and databases linked to your topics</p>
        {notionAccounts.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Notion workspaces connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your Notion pages, databases, and wikis</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notionAccounts.map((a) => (
              <div key={a.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium text-lg">
                    {a.workspace_icon || 'N'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.workspace_name || 'Notion Workspace'}</p>
                    <span className="text-xs text-gray-400 flex items-center gap-1">{sourceIcon('notion')} Pages, databases, wikis</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Connected
                  </span>
                  <button
                    onClick={() => disconnectNotion(a.id, a.workspace_name || 'Notion Workspace')}
                    disabled={disconnecting === a.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                    title="Disconnect"
                  >
                    {disconnecting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
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
              {sourceIcon('gmail')} {sourceIcon('calendar')} {sourceIcon('drive')} {sourceIcon('slack')} {sourceIcon('notion')} Multi-source search
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
            </div>
            <button onClick={async () => {
              toast.info('Preparing data export...');
              try {
                const [topicsRes, contactsRes, itemsRes] = await Promise.all([
                  fetch('/api/topics'),
                  fetch('/api/contacts'),
                  fetch('/api/topics').then(r => r.json()).then(async d => {
                    const items: unknown[] = [];
                    for (const t of (d.topics || []).slice(0, 50)) {
                      try {
                        const res = await fetch(`/api/topics/${t.id}/items`);
                        const data = await res.json();
                        items.push(...(data.items || []));
                      } catch {}
                    }
                    return items;
                  }),
                ]);
                const topics = await topicsRes.json();
                const contacts = await contactsRes.json();
                const exportData = {
                  exported_at: new Date().toISOString(),
                  version: 'TopicOS v3',
                  topics: topics.topics || [],
                  contacts: contacts.contacts || [],
                  items: itemsRes,
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `topicos-export-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Data exported successfully');
              } catch (err) {
                toast.error('Export failed');
              }
            }}
              className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
