import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TopicsList } from '@/components/topics/topics-list';

export default async function TopicsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: topics } = await supabase
    .from('topics')
    .select('*, topic_items(count)')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
      </div>
      <TopicsList initialTopics={topics ?? []} />
    </div>
  );
}
