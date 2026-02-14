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
  // Folder / grouping
  folder: z.string().max(100).nullable().optional(),
  // Extended project fields
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  owner: z.string().max(200).nullable().optional(),
  stakeholders: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  budget: z.string().max(100).nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  time_estimate_hours: z.number().min(0).nullable().optional(),
  time_spent_hours: z.number().min(0).nullable().optional(),
  progress_percent: z.number().int().min(0).max(100).nullable().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  client: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  goal: z.string().max(2000).nullable().optional(),
  outcome: z.string().max(2000).nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  repo_url: z.string().max(500).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).nullable().optional(),
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
