import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SettingsPanel } from '@/components/settings/settings-panel';

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [googleRes, slackRes, notionRes] = await Promise.all([
    supabase.from('google_accounts').select('id, email').eq('user_id', user!.id),
    supabase.from('slack_accounts').select('id, team_name').eq('user_id', user!.id),
    supabase.from('notion_accounts').select('id, workspace_name, workspace_icon').eq('user_id', user!.id),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your connected accounts, preferences, and AI configuration</p>
      </div>
      <SettingsPanel
        googleAccounts={googleRes.data ?? []}
        slackAccounts={slackRes.data ?? []}
        notionAccounts={notionRes.data ?? []}
      />
    </div>
  );
}
