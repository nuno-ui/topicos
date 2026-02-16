import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TopicDetail } from '@/components/topics/topic-detail';
import { notFound } from 'next/navigation';

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: topic } = await supabase.from('topics').select('*').eq('id', id).eq('user_id', user!.id).single();
  if (!topic) notFound();
  const { data: items } = await supabase.from('topic_items').select('*').eq('topic_id', id).order('occurred_at', { ascending: false });
  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      <TopicDetail topic={topic} initialItems={items ?? []} />
    </div>
  );
}
