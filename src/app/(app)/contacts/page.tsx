import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ContactsList } from '@/components/contacts/contacts-list';

export default async function ContactsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, contact_topic_links(topic_id, role, topics(title))')
    .eq('user_id', user!.id)
    .order('name', { ascending: true });

  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="text-gray-500 mt-1 text-sm">People from your topics, emails, and connected sources</p>
      </div>
      <ContactsList initialContacts={contacts ?? []} />
    </div>
  );
}
