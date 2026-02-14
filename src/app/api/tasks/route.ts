import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

/* ---------- GET ---------- */

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get('topic_id');

  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (topicId) {
    query = query.eq('topic_id', topicId);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(tasks);
}

/* ---------- POST ---------- */

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  topic_id: z.string().uuid().optional().nullable(),
  due_at: z.string().optional().nullable(),
  created_by: z.enum(['user', 'curator', 'executor']).optional().default('user'),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { title, topic_id, due_at, created_by } = parsed.data;

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title,
      topic_id: topic_id ?? null,
      due_at: due_at ?? null,
      status: 'pending',
      source_item_id: null,
      created_by: created_by ?? 'user',
      rationale: null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(task, { status: 201 });
}
