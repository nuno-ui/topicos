import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const area = searchParams.get('area');
    const search = searchParams.get('q');
    const parsedLimit = parseInt(searchParams.get('limit') || '100');
    const limit = Math.min(Number.isNaN(parsedLimit) ? 100 : parsedLimit, 500);

    let query = supabase
      .from('topics')
      .select('*, topic_items(count)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (area && area !== 'all') query = query.eq('area', area);
    if (search) {
      const safeSearch = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
    }
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ topics: data, total: data?.length ?? 0 });
  } catch (err) {
    console.error('GET /api/topics error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, description, area = 'work', due_date, start_date, priority, tags, folder_id, status: topicStatus } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      return NextResponse.json({ error: 'Title must be at least 2 characters' }, { status: 400 });
    }
    if (title.trim().length > 255) {
      return NextResponse.json({ error: 'Title must be 255 characters or less' }, { status: 400 });
    }

    const validAreas = ['work', 'personal', 'career'];
    const validStatuses = ['active', 'paused', 'completed', 'archived'];

    if (!validAreas.includes(area)) {
      return NextResponse.json({ error: 'Area must be work, personal, or career' }, { status: 400 });
    }
    if (topicStatus && !validStatuses.includes(topicStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (priority != null && (typeof priority !== 'number' || priority < 1 || priority > 5)) {
      return NextResponse.json({ error: 'Priority must be between 1 and 5' }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      title: title.trim(),
      description: description?.trim() || null,
      area,
      due_date: due_date || null,
      user_id: user.id,
      status: topicStatus || 'active',
    };
    if (start_date) insertData.start_date = start_date;
    if (priority != null) insertData.priority = priority;
    if (tags && Array.isArray(tags)) insertData.tags = tags;
    if (folder_id) insertData.folder_id = folder_id;

    let { data, error } = await supabase.from('topics').insert(insertData).select().single();

    // If schema cache error, retry with only base fields (new columns may not exist yet)
    if (error && error.message.includes('schema cache')) {
      console.warn('POST /api/topics: new columns not in schema, retrying with base fields only');
      const safeData: Record<string, unknown> = {
        title: insertData.title,
        description: insertData.description,
        status: insertData.status,
        area: insertData.area,
        due_date: insertData.due_date,
        user_id: insertData.user_id,
      };
      const retry = await supabase.from('topics').insert(safeData).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ topic: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/topics error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
