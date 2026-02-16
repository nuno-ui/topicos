import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TopicDetail } from '@/components/topics/topic-detail';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { title: 'Topic' };

  const { data: topic } = await supabase
    .from('topics')
    .select('title')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  return { title: topic ? `${topic.title} - Topics` : 'Topic' };
}

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch topic, items, and contacts in parallel
  const [topicRes, itemsRes, contactsRes] = await Promise.all([
    supabase.from('topics').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('topic_items').select('*').eq('topic_id', id).order('occurred_at', { ascending: false }),
    supabase.from('contact_topic_links').select('*, contacts(id, name, email, organization, role)').eq('topic_id', id).eq('user_id', user!.id),
  ]);

  if (!topicRes.data) notFound();

  return (
    <div className="p-4 md:p-8 max-w-5xl animate-page-enter">
      <TopicDetail topic={topicRes.data} initialItems={itemsRes.data ?? []} initialContacts={contactsRes.data ?? []} />
    </div>
  );
}
