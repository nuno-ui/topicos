import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TopicDetail } from '@/components/topics/topic-detail';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// Prevent any caching — always fetch fresh data on every request
export const dynamic = 'force-dynamic';

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
  const [topicRes, itemsRes, contactsRes, childrenRes] = await Promise.all([
    supabase.from('topics').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('topic_items').select('*').eq('topic_id', id).order('occurred_at', { ascending: false }),
    supabase.from('contact_topic_links').select('*, contacts(id, name, email, organization, role)').eq('topic_id', id).eq('user_id', user!.id),
    supabase.from('topics').select('id, title, status, area, priority, updated_at, progress_percent, description, tags, parent_topic_id').eq('parent_topic_id', id).eq('user_id', user!.id).order('updated_at', { ascending: false }),
  ]);

  if (!topicRes.data) notFound();

  // Fetch parent topic if this is a sub-topic (depends on topicRes)
  let parentTopic: { id: string; title: string; area: string; parent_topic_id: string | null } | null = null;
  if (topicRes.data.parent_topic_id) {
    const { data: parent } = await supabase
      .from('topics')
      .select('id, title, area, parent_topic_id')
      .eq('id', topicRes.data.parent_topic_id)
      .eq('user_id', user!.id)
      .single();
    parentTopic = parent;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl animate-page-enter">
      <TopicDetail
        topic={topicRes.data}
        initialItems={itemsRes.data ?? []}
        initialContacts={contactsRes.data ?? []}
        childTopics={childrenRes.data ?? []}
        parentTopic={parentTopic}
      />
    </div>
  );
}
