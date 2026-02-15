import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SettingsPanel } from '@/components/settings/settings-panel';

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: googleAccounts } = await supabase
    .from('google_accounts').select('id, email').eq('user_id', user!.id);
  const { data: slackAccounts } = await supabase
    .from('slack_accounts').select('id, team_name').eq('user_id', user!.id);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>
      <SettingsPanel
        googleAccounts={googleAccounts ?? []}
        slackAccounts={slackAccounts ?? []}
      />
    </div>
  );
}
