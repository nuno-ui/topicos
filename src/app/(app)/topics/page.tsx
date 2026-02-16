import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TopicsList } from '@/components/topics/topics-list';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Topics - TopicOS',
  description: 'Organize your work, projects, and personal matters into topic clusters',
};

export default async function TopicsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [topicsRes, foldersRes] = await Promise.all([
    supabase
      .from('topics')
      .select('*, topic_items(count)')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('folders')
      .select('*')
      .eq('user_id', user!.id)
      .order('position', { ascending: true }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-6xl animate-page-enter">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="text-gray-500 mt-1 text-sm">Organize your work, projects, and personal matters into topic clusters</p>
        </div>
      </div>
      <TopicsList
        initialTopics={topicsRes.data ?? []}
        initialFolders={foldersRes.data ?? []}
      />
    </div>
  );
}
