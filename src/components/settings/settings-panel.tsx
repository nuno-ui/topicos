'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, Plus } from 'lucide-react';

interface Props {
  googleAccounts: { id: string; email: string }[];
  slackAccounts: { id: string; team_name: string }[];
}

export function SettingsPanel({ googleAccounts: initialGoogle, slackAccounts: initialSlack }: Props) {
  const [googleAccounts, setGoogleAccounts] = useState(initialGoogle);
  const [slackAccounts, setSlackAccounts] = useState(initialSlack);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const connectGoogle = () => {
    window.location.href = '/api/auth/google/connect';
  };

  const connectSlack = () => {
    window.location.href = '/api/auth/slack/connect';
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

  return (
    <div className="space-y-8">
      {/* Google Accounts */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Google Accounts</h2>
        <p className="text-sm text-gray-500 mb-4">Connect Google to search Gmail, Calendar, and Drive</p>
        {googleAccounts.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Google accounts connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your emails, events, and files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {googleAccounts.map((a) => (
              <div key={a.id} className="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-medium">G</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.email}</p>
                    <p className="text-xs text-gray-400">Gmail, Calendar, Drive</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">Connected</span>
                  <button
                    onClick={() => disconnectGoogle(a.id, a.email)}
                    disabled={disconnecting === a.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Connect Google Account
        </button>
      </div>

      {/* Slack Workspaces */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Slack Workspaces</h2>
        <p className="text-sm text-gray-500 mb-4">Connect Slack to search messages across channels and DMs</p>
        {slackAccounts.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No Slack workspaces connected</p>
            <p className="text-xs text-gray-400 mt-1">Connect to search your Slack messages</p>
          </div>
        ) : (
          <div className="space-y-2">
            {slackAccounts.map((a) => (
              <div key={a.id} className="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium">S</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.team_name}</p>
                    <p className="text-xs text-gray-400">Messages, channels, DMs</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">Connected</span>
                  <button
                    onClick={() => disconnectSlack(a.id, a.team_name)}
                    disabled={disconnecting === a.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
          className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Connect Slack Workspace
        </button>
      </div>
    </div>
  );
}
