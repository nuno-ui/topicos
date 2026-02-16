import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Verify topic ownership
    const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('contact_topic_links')
      .select('*, contacts(id, name, email, organization, role)')
      .eq('topic_id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contacts: data || [] });
  } catch (err) {
    console.error('GET /api/topics/[id]/contacts error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Verify topic ownership
    const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const body = await request.json();
    const { contact_id, role } = body;
    if (!contact_id) return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });

    // Verify contact ownership
    const { data: contact } = await supabase.from('contacts').select('id').eq('id', contact_id).eq('user_id', user.id).single();
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const { data, error } = await supabase.from('contact_topic_links').upsert({
      user_id: user.id,
      contact_id,
      topic_id: id,
      role: role || null,
    }, { onConflict: 'contact_id, topic_id' }).select('*, contacts(id, name, email, organization, role)').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ link: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/topics/[id]/contacts error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(request.url);
    const contactId = url.searchParams.get('contact_id');
    if (!contactId) return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });

    const { error } = await supabase
      .from('contact_topic_links')
      .delete()
      .eq('topic_id', id)
      .eq('contact_id', contactId)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/topics/[id]/contacts error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
