import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    // Fetch child topics
    const { data: children } = await supabase
      .from('topics')
      .select('id, title, status, area, priority, updated_at, progress_percent, description, tags, parent_topic_id')
      .eq('parent_topic_id', id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    // Fetch parent topic info if this is a sub-topic
    let parentTopic = null;
    if (data.parent_topic_id) {
      const { data: parent } = await supabase
        .from('topics')
        .select('id, title, area, parent_topic_id')
        .eq('id', data.parent_topic_id)
        .eq('user_id', user.id)
        .single();
      parentTopic = parent;
    }

    return NextResponse.json({ topic: { ...data, children: children || [] }, parentTopic });
  } catch (err) {
    console.error('GET /api/topics/[id] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
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

    // Validate parent_topic_id hierarchy if provided
    if (body.parent_topic_id !== undefined) {
      if (body.parent_topic_id === id) {
        return NextResponse.json({ error: 'A topic cannot be its own parent' }, { status: 400 });
      }
      if (body.parent_topic_id) {
        // Validate parent exists and belongs to user
        const { data: parentTopic } = await supabase
          .from('topics')
          .select('id, parent_topic_id')
          .eq('id', body.parent_topic_id)
          .eq('user_id', user.id)
          .single();
        if (!parentTopic) {
          return NextResponse.json({ error: 'Parent topic not found' }, { status: 400 });
        }
        // Check for circular reference: walk down descendants of this topic
        const checkCircular = async (topicId: string): Promise<boolean> => {
          const { data: childrenCheck } = await supabase
            .from('topics').select('id').eq('parent_topic_id', topicId).eq('user_id', user.id);
          if (!childrenCheck) return false;
          for (const child of childrenCheck) {
            if (child.id === body.parent_topic_id) return true;
            if (await checkCircular(child.id)) return true;
          }
          return false;
        };
        if (await checkCircular(id)) {
          return NextResponse.json({ error: 'Circular hierarchy detected' }, { status: 400 });
        }
        // Check depth from parent upwards
        let depth = 1;
        let currentParentId = parentTopic.parent_topic_id;
        while (currentParentId) {
          depth++;
          if (depth > 2) {
            return NextResponse.json({ error: 'Topic hierarchy cannot exceed 3 levels' }, { status: 400 });
          }
          const { data: ancestor } = await supabase
            .from('topics').select('parent_topic_id').eq('id', currentParentId).single();
          currentParentId = ancestor?.parent_topic_id || null;
        }
        // Check if this topic has children that would exceed depth
        const { data: existingChildren } = await supabase
          .from('topics').select('id').eq('parent_topic_id', id);
        if (existingChildren && existingChildren.length > 0 && depth > 1) {
          return NextResponse.json({ error: 'Cannot nest this topic deeper: it has children that would exceed max depth' }, { status: 400 });
        }
        // Check for grandchildren
        if (existingChildren && existingChildren.length > 0) {
          for (const child of existingChildren) {
            const { data: grandchildren } = await supabase
              .from('topics').select('id').eq('parent_topic_id', child.id).limit(1);
            if (grandchildren && grandchildren.length > 0 && depth > 0) {
              return NextResponse.json({ error: 'Cannot nest this topic: it has grandchildren that would exceed max depth' }, { status: 400 });
            }
          }
        }
      }
    }

    // Only allow known fields to be updated (prevent arbitrary field injection)
    const allowedFields = ['title', 'description', 'area', 'status', 'due_date', 'start_date', 'priority', 'tags', 'folder_id', 'parent_topic_id', 'summary', 'notes', 'progress_percent', 'owner', 'goal', 'updated_at'];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updateData[key] = body[key];
    }
    // Trim title if present
    if (updateData.title && typeof updateData.title === 'string') updateData.title = updateData.title.trim();
    // Trim owner and goal if present
    if (updateData.owner !== undefined) updateData.owner = (typeof updateData.owner === 'string' && updateData.owner.trim()) ? updateData.owner.trim() : null;
    if (updateData.goal !== undefined) updateData.goal = (typeof updateData.goal === 'string' && updateData.goal.trim()) ? updateData.goal.trim() : null;
    // Always update timestamp
    updateData.updated_at = new Date().toISOString();

    let { data, error } = await supabase
      .from('topics')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    // If schema cache error, retry with all known fields
    if (error && error.message.includes('schema cache')) {
      console.warn('PATCH /api/topics/[id]: schema cache error, retrying with known fields');
      const knownFields = ['title', 'description', 'area', 'status', 'due_date', 'start_date', 'priority', 'tags', 'folder_id', 'parent_topic_id', 'summary', 'notes', 'progress_percent', 'owner', 'goal', 'updated_at'];
      const safeData: Record<string, unknown> = {};
      for (const key of knownFields) {
        if (key in updateData) safeData[key] = updateData[key];
      }
      const retry = await supabase
        .from('topics')
        .update(safeData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ topic: data });
  } catch (err) {
    console.error('PATCH /api/topics/[id] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Clean up related records first
    await Promise.all([
      supabase.from('topic_items').delete().eq('topic_id', id).eq('user_id', user.id),
      supabase.from('contact_topic_links').delete().eq('topic_id', id).eq('user_id', user.id),
      // Detach child topics (set their parent to null) — redundant with FK ON DELETE SET NULL but explicit
      supabase.from('topics').update({ parent_topic_id: null }).eq('parent_topic_id', id),
    ]);

    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/topics/[id] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
