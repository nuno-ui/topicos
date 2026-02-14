import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ContactsClient } from '@/components/contacts/contacts-client';

export default async function ContactsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('interaction_count', { ascending: false });

  // Fetch contact-topic links with topic info
  const { data: contactTopicLinks } = await supabase
    .from('contact_topic_links')
    .select('*, topics:topic_id(id, title, area)')
    .eq('user_id', user.id);

  // Build a map of contact_id -> topics
  const contactTopicsMap: Record<string, { id: string; title: string; area: string }[]> = {};
  for (const link of contactTopicLinks ?? []) {
    if (!contactTopicsMap[link.contact_id]) {
      contactTopicsMap[link.contact_id] = [];
    }
    if (link.topics) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topic = link.topics as any;
      contactTopicsMap[link.contact_id].push({
        id: topic.id,
        title: topic.title,
        area: topic.area,
      });
    }
  }

  return (
    <ContactsClient
      contacts={contacts ?? []}
      contactTopicsMap={contactTopicsMap}
    />
  );
}
