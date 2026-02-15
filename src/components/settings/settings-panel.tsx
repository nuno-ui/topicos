'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, Plus, Shield } from 'lucide-react';
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

  return (
    <div className="space-y-8">
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
              <div key={a.id} className="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
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
          className="mt-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors">
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
              <div key={a.id} className="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
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
          className="mt-3 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2 transition-colors">
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
              <div key={a.id} className="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
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
          className="mt-3 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors">
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
        <div className="p-4 bg-white rounded-lg border border-gray-200">
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
    </div>
  );
}
