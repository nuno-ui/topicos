import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('priority', { ascending: false });

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('due_at', { ascending: true })
    .limit(10);

  const { data: accounts } = await supabase
    .from('google_accounts')
    .select('id, email, last_sync_at')
    .eq('user_id', user.id);

  const { data: recentSyncs } = await supabase
    .from('sync_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(5);

  // Count untriaged items (items not linked to any topic)
  const { data: allItems } = await supabase
    .from('items')
    .select('id')
    .eq('user_id', user.id);

  const { data: topicLinksData } = await supabase
    .from('topic_links')
    .select('item_id')
    .eq('user_id', user.id);

  const linkedIds = new Set(
    (topicLinksData ?? []).map((link: { item_id: string }) => link.item_id)
  );

  const untriagedCount = (allItems ?? []).filter(
    (item: { id: string }) => !linkedIds.has(item.id)
  ).length;

  // Get recent items for dashboard feed (most recently synced, with occurred_at in past or today)
  const { data: recentItems } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .lte('occurred_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(10);

  return (
    <DashboardClient
      topics={topics ?? []}
      tasks={tasks ?? []}
      accounts={accounts ?? []}
      recentSyncs={recentSyncs ?? []}
      untriagedCount={untriagedCount}
      recentItems={recentItems ?? []}
    />
  );
}
