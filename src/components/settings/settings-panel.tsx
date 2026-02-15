'use client';

interface Props {
  googleAccounts: { id: string; email: string }[];
  slackAccounts: { id: string; team_name: string }[];
}

export function SettingsPanel({ googleAccounts, slackAccounts }: Props) {
  const connectGoogle = () => {
    window.location.href = '/api/auth/google/connect';
  };

  const connectSlack = () => {
    window.location.href = '/api/auth/slack/connect';
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-4">Google Accounts</h2>
        {!googleAccounts.length ? (
          <p className="text-gray-500">No Google accounts connected</p>
        ) : (
          <div className="space-y-2">
            {googleAccounts.map((a) => (
              <div key={a.id} className="p-3 bg-white rounded-lg border flex items-center justify-between">
                <span>{a.email}</span>
                <span className="text-green-600 text-sm">Connected</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={connectGoogle} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          Connect Google Account
        </button>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-4">Slack Workspaces</h2>
        {!slackAccounts.length ? (
          <p className="text-gray-500">No Slack workspaces connected</p>
        ) : (
          <div className="space-y-2">
            {slackAccounts.map((a) => (
              <div key={a.id} className="p-3 bg-white rounded-lg border flex items-center justify-between">
                <span>{a.team_name}</span>
                <span className="text-green-600 text-sm">Connected</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={connectSlack} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">
          Connect Slack Workspace
        </button>
      </div>
    </div>
  );
}
