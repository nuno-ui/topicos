import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify contact ownership
  const { data: contact } = await supabase.from('contacts').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const body = await request.json();
  const { topic_id, role } = body;
  if (!topic_id) return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });

  // Verify topic ownership
  const { data: topic } = await supabase.from('topics').select('id').eq('id', topic_id).eq('user_id', user.id).single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  const { data, error } = await supabase.from('contact_topic_links').upsert({
    user_id: user.id,
    contact_id: id,
    topic_id,
    role: role || null,
  }, { onConflict: 'contact_id, topic_id' }).select('*, topics(title, status, due_date, priority, area, updated_at, tags)').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const topicId = url.searchParams.get('topic_id');
  if (!topicId) return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });

  const { error } = await supabase
    .from('contact_topic_links')
    .delete()
    .eq('contact_id', id)
    .eq('topic_id', topicId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { topic_id, role } = body;
  if (!topic_id) return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('contact_topic_links')
    .update({ role: role || null })
    .eq('contact_id', id)
    .eq('topic_id', topic_id)
    .eq('user_id', user.id)
    .select('*, topics(title, status, due_date, priority, area, updated_at, tags)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}
