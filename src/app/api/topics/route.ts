import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('topics')
    .select('*, topic_items(count)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ topics: data });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, description, area = 'work', due_date, start_date, priority, tags, folder_id, status: topicStatus } = body;
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const insertData: Record<string, unknown> = {
    title,
    description: description || null,
    area,
    due_date: due_date || null,
    user_id: user.id,
    status: topicStatus || 'active',
  };
  if (start_date) insertData.start_date = start_date;
  if (priority != null) insertData.priority = priority;
  if (tags) insertData.tags = tags;
  if (folder_id) insertData.folder_id = folder_id;

  const { data, error } = await supabase.from('topics').insert(insertData).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ topic: data }, { status: 201 });
}
