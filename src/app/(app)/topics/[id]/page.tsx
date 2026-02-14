import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TopicDossierClient } from '@/components/topics/topic-dossier-client';
import type { Topic, Item, TopicLink, Task } from '@/types/database';

interface TopicPageProps {
  params: Promise<{ id: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .single();

  if (!topic) redirect('/topics');

  const { data: topicLinks } = await supabase
    .from('topic_links')
    .select('*, items(*)')
    .eq('topic_id', id)
    .order('created_at', { ascending: false });

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('topic_id', id)
    .order('created_at', { ascending: false });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const linkedItems = (topicLinks ?? [])
    .map((row: any) => ({
      link: {
        id: row.id,
        user_id: row.user_id,
        topic_id: row.topic_id,
        item_id: row.item_id,
        confidence: row.confidence,
        reason: row.reason,
        created_by: row.created_by,
        created_at: row.created_at,
      } as TopicLink,
      item: row.items as Item,
    }))
    .filter((entry: any) => entry.item !== null);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <TopicDossierClient
      topic={topic as Topic}
      linkedItems={linkedItems}
      tasks={(tasks ?? []) as Task[]}
    />
  );
}
