import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/* ---------- GET ---------- */

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: topic, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  return NextResponse.json(topic);
}

/* ---------- PATCH ---------- */

const updateTopicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  area: z.enum(['personal', 'career', 'work']).optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  priority: z.number().int().min(0).optional(),
  summary: z.string().max(10000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
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

  const parsed = updateTopicSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  // Ensure we have at least one field to update
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: topic, error } = await supabase
    .from('topics')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error || !topic) {
    return NextResponse.json(
      { error: error?.message ?? 'Topic not found' },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json(topic);
}

/* ---------- DELETE ---------- */

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
