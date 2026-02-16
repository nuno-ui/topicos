import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: topic } = await supabase
    .from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  const { error } = await supabase
    .from('topic_items')
    .delete()
    .eq('id', itemId)
    .eq('topic_id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: topic } = await supabase
    .from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  const body = await request.json();
  const allowedFields = ['title', 'snippet', 'body', 'metadata', 'occurred_at', 'url'];
  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('topic_items')
    .update(updateData)
    .eq('id', itemId)
    .eq('topic_id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: update parent topic timestamp
  await supabase.from('topics').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);

  return NextResponse.json({ item: data });
}