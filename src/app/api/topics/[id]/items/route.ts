import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify topic ownership
  const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('topic_items')
    .select('*')
    .eq('topic_id', id)
    .order('occurred_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { external_id, source, source_account_id, title, snippet, url, occurred_at, metadata } = body;

  const { data, error } = await supabase.from('topic_items').insert({
    topic_id: id,
    external_id,
    source,
    source_account_id: source_account_id || null,
    title,
    snippet: snippet || '',
    url: url || '',
    occurred_at: occurred_at || new Date().toISOString(),
    metadata: metadata || {},
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update topic updated_at
  await supabase.from('topics').update({ updated_at: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ item: data }, { status: 201 });
}
