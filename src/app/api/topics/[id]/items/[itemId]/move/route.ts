import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify source topic ownership
  const { data: sourceTopic } = await supabase
    .from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!sourceTopic) return NextResponse.json({ error: 'Source topic not found' }, { status: 404 });

  const body = await request.json();
  const { target_topic_id } = body;
  if (!target_topic_id) return NextResponse.json({ error: 'target_topic_id is required' }, { status: 400 });

  // Verify target topic ownership
  const { data: targetTopic } = await supabase
    .from('topics').select('id').eq('id', target_topic_id).eq('user_id', user.id).single();
  if (!targetTopic) return NextResponse.json({ error: 'Target topic not found' }, { status: 404 });

  // Verify item exists in source topic
  const { data: item } = await supabase
    .from('topic_items')
    .select('id')
    .eq('id', itemId)
    .eq('topic_id', id)
    .single();
  if (!item) return NextResponse.json({ error: 'Item not found in source topic' }, { status: 404 });

  // Move the item
  const { error } = await supabase
    .from('topic_items')
    .update({ topic_id: target_topic_id })
    .eq('id', itemId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update both topics' timestamps
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from('topics').update({ updated_at: now }).eq('id', id).eq('user_id', user.id),
    supabase.from('topics').update({ updated_at: now }).eq('id', target_topic_id).eq('user_id', user.id),
  ]);

  return NextResponse.json({ success: true, moved_to: target_topic_id });
}
