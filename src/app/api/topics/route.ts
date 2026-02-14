import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createTopicSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  area: z.enum(['personal', 'career', 'work']),
  description: z.string().max(2000).optional().default(''),
  folder: z.string().max(100).nullable().optional(),
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: topics, error } = await supabase
    .from('topics')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(topics);
}

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

  const parsed = createTopicSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { title, area, description, folder } = parsed.data;

  const { data: topic, error } = await supabase
    .from('topics')
    .insert({
      user_id: user.id,
      title,
      area,
      description: description ?? '',
      status: 'active',
      priority: 0,
      summary: null,
      folder: folder ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(topic, { status: 201 });
}
