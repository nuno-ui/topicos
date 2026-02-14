import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { InboxClient } from '@/components/inbox/inbox-client';

export default async function InboxPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch all items (ordered by date)
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false });

  // Fetch topic links to know which items are linked
  const { data: topicLinks } = await supabase
    .from('topic_links')
    .select('*')
    .eq('user_id', user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedItemIds = (topicLinks ?? []).map((link: any) => link.item_id as string);

  // Fetch topics for linking
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  // Fetch google accounts for badges and filtering
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
    />
  );
}
