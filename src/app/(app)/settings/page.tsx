import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SettingsPanel } from '@/components/settings/settings-panel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings - YouOS',
  description: 'Manage your connected sources and account settings',
};

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const [googleRes, slackRes, notionRes] = await Promise.all([
    supabase.from('google_accounts').select('id, email').eq('user_id', userId),
    supabase.from('slack_accounts').select('id, team_name').eq('user_id', userId),
    supabase.from('notion_accounts').select('id, workspace_name, workspace_icon').eq('user_id', userId),
  ]);

  // Query last sync times per source_account_id from topic_items
  // This gives us the most recent created_at for items from each connected account
  const { data: syncData } = await supabase
    .from('topic_items')
    .select('source_account_id, created_at')
    .eq('user_id', userId)
    .not('source_account_id', 'is', null)
    .order('created_at', { ascending: false });

  // Build a map of account_id -> { lastSyncAt, latestItemAt }
  const accountSyncMap: Record<string, string> = {};
  if (syncData) {
    for (const row of syncData) {
      if (row.source_account_id && !accountSyncMap[row.source_account_id]) {
        accountSyncMap[row.source_account_id] = row.created_at;
      }
    }
  }

  return (
    <div className="p-8 max-w-3xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your connected accounts, preferences, and AI configuration</p>
      </div>
      <SettingsPanel
        googleAccounts={googleRes.data ?? []}
        slackAccounts={slackRes.data ?? []}
        notionAccounts={notionRes.data ?? []}
        accountSyncMap={accountSyncMap}
      />
    </div>
  );
}
