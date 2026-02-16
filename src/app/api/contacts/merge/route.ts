import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { primary_id, secondary_id } = body;
  if (!primary_id || !secondary_id) return NextResponse.json({ error: 'Both contact IDs required' }, { status: 400 });
  if (primary_id === secondary_id) return NextResponse.json({ error: 'Cannot merge a contact with itself' }, { status: 400 });

  // Fetch both contacts
  const { data: primary } = await supabase.from('contacts').select('*').eq('id', primary_id).eq('user_id', user.id).single();
  const { data: secondary } = await supabase.from('contacts').select('*').eq('id', secondary_id).eq('user_id', user.id).single();
  if (!primary || !secondary) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  // Merge: fill missing fields in primary from secondary
  const mergeFields: Record<string, unknown> = {};
  if (!primary.email && secondary.email) mergeFields.email = secondary.email;
  if (!primary.organization && secondary.organization) mergeFields.organization = secondary.organization;
  if (!primary.role && secondary.role) mergeFields.role = secondary.role;
  if (!primary.area && secondary.area) mergeFields.area = secondary.area;
  if (!primary.notes && secondary.notes) {
    mergeFields.notes = secondary.notes;
  } else if (primary.notes && secondary.notes) {
    mergeFields.notes = primary.notes + '\n\n---\nMerged from ' + secondary.name + ':\n' + secondary.notes;
  }

  // Merge metadata
  const primaryMeta = primary.metadata || {};
  const secondaryMeta = secondary.metadata || {};
  mergeFields.metadata = { ...secondaryMeta, ...primaryMeta };

  // Combine interaction counts
  mergeFields.interaction_count = (primary.interaction_count || 0) + (secondary.interaction_count || 0);
  if (secondary.last_interaction_at && (!primary.last_interaction_at || new Date(secondary.last_interaction_at) > new Date(primary.last_interaction_at))) {
    mergeFields.last_interaction_at = secondary.last_interaction_at;
  }

  // Update primary with merged data
  if (Object.keys(mergeFields).length > 0) {
    await supabase.from('contacts').update(mergeFields).eq('id', primary_id);
  }

  // Transfer topic links from secondary to primary (skip duplicates)
  const { data: secondaryLinks } = await supabase
    .from('contact_topic_links')
    .select('topic_id, role')
    .eq('contact_id', secondary_id);

  if (secondaryLinks && secondaryLinks.length > 0) {
    for (const link of secondaryLinks) {
      await supabase.from('contact_topic_links').upsert({
        user_id: user.id,
        contact_id: primary_id,
        topic_id: link.topic_id,
        role: link.role,
      }, { onConflict: 'contact_id, topic_id' });
    }
  }

  // Delete secondary's topic links and then the contact
  await supabase.from('contact_topic_links').delete().eq('contact_id', secondary_id);
  await supabase.from('contacts').delete().eq('id', secondary_id).eq('user_id', user.id);

  // Fetch updated primary
  const { data: merged } = await supabase
    .from('contacts')
    .select('*, contact_topic_links(topic_id, role, topics(title))')
    .eq('id', primary_id)
    .single();

  return NextResponse.json({ contact: merged, merged_links: secondaryLinks?.length || 0 });
}
