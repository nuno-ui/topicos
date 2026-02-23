import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    let query = supabase
      .from('topic_tasks')
      .select('*')
      .eq('topic_id', id)
      .eq('user_id', user.id);

    if (statusFilter === 'active') {
      query = query.in('status', ['pending', 'in_progress']);
    } else if (statusFilter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (statusFilter === 'archived') {
      query = query.eq('status', 'archived');
    }

    const { data, error } = await query
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data });
  } catch (err) {
    console.error('GET /api/topics/[id]/tasks error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const body = await request.json();

    // Support bulk insert (for AI extraction) or single insert
    const tasksToInsert = Array.isArray(body.tasks) ? body.tasks : [body];

    const insertData = tasksToInsert.map((t: Record<string, unknown>, index: number) => ({
      user_id: user.id,
      topic_id: id,
      title: (t.title as string) || 'Untitled task',
      description: (t.description as string) || '',
      status: t.status || 'pending',
      priority: t.priority || 'medium',
      due_date: t.due_date || null,
      assignee: t.assignee || null,
      assignee_contact_id: t.assignee_contact_id || null,
      source: t.source || 'manual',
      source_item_ref: t.source_item_ref || null,
      position: typeof t.position === 'number' ? t.position : index,
      metadata: t.metadata || {},
    }));

    const { data, error } = await supabase.from('topic_tasks').insert(insertData).select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update topic updated_at
    await supabase.from('topics').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);

    // Auto-link contacts for tasks with assignee_contact_id
    const contactIdsToLink = new Set<string>();
    for (const t of insertData) {
      if (t.assignee_contact_id) contactIdsToLink.add(t.assignee_contact_id);
    }
    if (contactIdsToLink.size > 0) {
      const linkRows = Array.from(contactIdsToLink).map(cid => ({
        user_id: user.id, contact_id: cid, topic_id: id,
      }));
      await supabase.from('contact_topic_links').upsert(linkRows, { onConflict: 'contact_id, topic_id' })
        .then(({ error: linkErr }) => {
          if (linkErr) console.error('Auto-link task assignee error:', linkErr.message);
        });
    }

    // Return single task for single insert, array for bulk
    if (!Array.isArray(body.tasks)) {
      return NextResponse.json({ task: data![0] }, { status: 201 });
    }
    return NextResponse.json({ tasks: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/topics/[id]/tasks error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
