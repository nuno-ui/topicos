import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  return NextResponse.json({ topic: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Validate specific fields
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length < 2)) {
    return NextResponse.json({ error: 'Title must be at least 2 characters' }, { status: 400 });
  }
  if (body.area !== undefined && !['work', 'personal', 'career'].includes(body.area)) {
    return NextResponse.json({ error: 'Area must be work, personal, or career' }, { status: 400 });
  }
  if (body.status !== undefined && !['active', 'paused', 'completed', 'archived'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (body.priority !== undefined && body.priority !== null && (typeof body.priority !== 'number' || body.priority < 1 || body.priority > 5)) {
    return NextResponse.json({ error: 'Priority must be between 1 and 5' }, { status: 400 });
  }
  if (body.progress_percent !== undefined && body.progress_percent !== null && (typeof body.progress_percent !== 'number' || body.progress_percent < 0 || body.progress_percent > 100)) {
    return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 });
  }

  // Only allow known fields to be updated (prevent arbitrary field injection)
  const allowedFields = ['title', 'description', 'area', 'status', 'due_date', 'start_date', 'priority', 'tags', 'folder_id', 'summary', 'notes', 'progress_percent', 'updated_at'];
  const updateData: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updateData[key] = body[key];
  }
  // Trim title if present
  if (updateData.title && typeof updateData.title === 'string') updateData.title = updateData.title.trim();
  // Always update timestamp
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('topics')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ topic: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Clean up related records first
  await Promise.all([
    supabase.from('topic_items').delete().eq('topic_id', id).eq('user_id', user.id),
    supabase.from('contact_topic_links').delete().eq('topic_id', id),
  ]);

  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
