import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SettingsClient } from '@/components/settings/settings-client';

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: googleAccounts } = await supabase
    .from('google_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: recentSyncs } = await supabase
    .from('sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);

  return (
    <SettingsClient
      profile={profile}
      googleAccounts={googleAccounts ?? []}
      recentSyncs={recentSyncs ?? []}
    />
  );
}
