import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ContactDetail } from '@/components/contacts/contact-detail';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { notFound } from 'next/navigation';
import { getContactItems, updateContactStats } from '@/lib/contacts/interaction-stats';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { title: 'Contact' };

  const { data: contact } = await supabase
    .from('contacts')
    .select('name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  return { title: contact ? `${contact.name} - Contacts` : 'Contact' };
}

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

  // Run stats update and items fetch in parallel - don't let stats failure break the page
  const [, relatedItems, topicsRes, contactItemsRes] = await Promise.all([
    updateContactStats(supabase, user!.id, { id: contact.id, name: contact.name, email: contact.email }).catch(() => null),
    getContactItems(supabase, user!.id, { id: contact.id, name: contact.name, email: contact.email }, 50).catch(() => []),
    supabase
      .from('topics')
      .select('id, title, status, area')
      .eq('user_id', user!.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false }),
    supabase
      .from('contact_items')
      .select('*')
      .eq('contact_id', id)
      .eq('user_id', user!.id)
      .order('occurred_at', { ascending: false }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-5xl animate-page-enter">
      <Breadcrumbs currentLabel={contact.name} />
      <ContactDetail
        contact={contact}
        relatedItems={relatedItems as Record<string, unknown>[]}
        allTopics={topicsRes.data ?? []}
        initialContactItems={contactItemsRes.data ?? []}
      />
    </div>
  );
}
