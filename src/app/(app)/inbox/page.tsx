import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { InboxClient } from '@/components/inbox/inbox-client';

export default async function InboxPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .order('occurred_at', { ascending: false });

  const { data: topicLinks } = await supabase
    .from('topic_links')
    .select('*');

  const linkedItemIds = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (topicLinks ?? []).map((link: any) => link.item_id)
  );

  const untriagedItems = (items ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => !linkedItemIds.has(item.id)
  );

  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  return (
    <InboxClient
      items={untriagedItems}
      topics={topics ?? []}
    />
  );
}
