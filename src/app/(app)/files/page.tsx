import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { InboxClient } from '@/components/inbox/inbox-client';

export default async function FilesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', 'drive')
    .neq('triage_status', 'deleted')
    .order('occurred_at', { ascending: false });

  const { data: topicLinks } = await supabase
    .from('topic_links')
    .select('*')
    .eq('user_id', user.id);

  const linkedItemIds = (topicLinks ?? []).map((link: any) => link.item_id as string);

  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  const { data: accounts } = await supabase
    .from('google_accounts')
    .select('id, email')
    .eq('user_id', user.id);

  return (
    <InboxClient
      items={items ?? []}
      linkedItemIds={linkedItemIds}
      topics={topics ?? []}
      accounts={(accounts ?? []) as { id: string; email: string }[]}
      pageTitle="Files"
      pageDescription="Documents and files from Google Drive"
      defaultSource="drive"
      hideTabs
    />
  );
}
