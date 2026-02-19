import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id, taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const body = await request.json();
    const allowedFields = ['title', 'description', 'status', 'priority', 'due_date', 'assignee', 'assignee_contact_id', 'position', 'metadata'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Auto-set timestamps on status transitions
    if (updateData.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (updateData.status === 'archived') {
      updateData.archived_at = new Date().toISOString();
    } else if (updateData.status === 'pending' || updateData.status === 'in_progress') {
      updateData.completed_at = null;
      updateData.archived_at = null;
    }

    // Validate status
    if (updateData.status && !['pending', 'in_progress', 'completed', 'archived'].includes(updateData.status as string)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    // Validate priority
    if (updateData.priority && !['high', 'medium', 'low'].includes(updateData.priority as string)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('topic_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('topic_id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('topics').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);

    return NextResponse.json({ task: data });
  } catch (err) {
    console.error('PATCH /api/topics/[id]/tasks/[taskId] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id, taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const { error } = await supabase
      .from('topic_tasks')
      .delete()
      .eq('id', taskId)
      .eq('topic_id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/topics/[id]/tasks/[taskId] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
