import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

/* ---------- POST ---------- */

const createTopicLinkSchema = z.object({
  topic_id: z.string().uuid('topic_id must be a valid UUID'),
  item_id: z.string().uuid('item_id must be a valid UUID'),
  confidence: z.number().min(0).max(1).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
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

  const parsed = createTopicLinkSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { topic_id, item_id, confidence, reason, created_by } = parsed.data;

  const { data: topicLink, error } = await supabase
    .from('topic_links')
    .insert({
      user_id: user.id,
      topic_id,
      item_id,
      confidence: confidence ?? null,
      reason: reason ?? null,
      created_by: created_by ?? 'user',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(topicLink, { status: 201 });
}

/* ---------- DELETE ---------- */

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const idSchema = z.string().uuid('id must be a valid UUID');
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: 'id must be a valid UUID' }, { status: 400 });
  }

  const { error } = await supabase
    .from('topic_links')
    .delete()
    .eq('id', parsed.data)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
