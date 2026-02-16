import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ContactDetail } from '@/components/contacts/contact-detail';
import { notFound } from 'next/navigation';
import { getContactItems, updateContactStats } from '@/lib/contacts/interaction-stats';

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: contact } = await supabase
    .from('contacts')
    .select('*, contact_topic_links(id, topic_id, role, created_at, topics(title, status, due_date, priority, area, updated_at, tags))')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single();

  if (!contact) notFound();

  // Compute and update interaction stats
  await updateContactStats(supabase, user!.id, { id: contact.id, name: contact.name, email: contact.email });

  // Get items mentioning this contact for the communication timeline
  const relatedItems = await getContactItems(supabase, user!.id, { id: contact.id, name: contact.name, email: contact.email }, 50);

  // Get all user's topics for the link-to-topic dropdown
  const { data: allTopics } = await supabase
    .from('topics')
    .select('id, title, status, area')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      <ContactDetail
        contact={contact}
        relatedItems={relatedItems as Record<string, unknown>[]}
        allTopics={allTopics ?? []}
      />
    </div>
  );
}
