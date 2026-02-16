import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ContactsList } from '@/components/contacts/contacts-list';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'People - YouOS',
  description: 'People from your topics, emails, and connected sources',
};

export default async function ContactsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch contacts with more relational data for better list display
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, contact_topic_links(topic_id, role, topics(title, status, area))')
    .eq('user_id', user!.id)
    .order('name', { ascending: true });

  return (
    <div className="p-4 md:p-8 max-w-5xl animate-page-enter">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="text-gray-500 mt-1 text-sm">People from your topics, emails, and connected sources</p>
      </div>
      <ContactsList initialContacts={contacts ?? []} />
    </div>
  );
}
