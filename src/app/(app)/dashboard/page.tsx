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
    .eq('status', 'active')
    .order('priority', { ascending: false });

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .order('due_at', { ascending: true })
    .limit(10);

  const { data: accounts } = await supabase
    .from('google_accounts')
    .select('id, email, last_sync_at');

  const { data: recentSyncs } = await supabase
    .from('sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);

  // Count untriaged items (items not linked to any topic)
  const { count: untriagedCount } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .not('id', 'in',
      supabase.from('topic_links').select('item_id')
    );

  return (
    <DashboardClient
      topics={topics ?? []}
      tasks={tasks ?? []}
      accounts={accounts ?? []}
      recentSyncs={recentSyncs ?? []}
      untriagedCount={untriagedCount ?? 0}
    />
  );
}
