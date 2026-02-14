import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TopicsListClient } from '@/components/topics/topics-list-client';

export default async function TopicsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .order('updated_at', { ascending: false });

  return <TopicsListClient topics={topics ?? []} />;
}
