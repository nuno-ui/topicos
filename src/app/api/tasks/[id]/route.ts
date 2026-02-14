import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/* ---------- PATCH ---------- */

const updateTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  title: z.string().min(1).max(500).optional(),
  due_at: z.string().nullable().optional(),
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

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error || !task) {
    return NextResponse.json(
      { error: error?.message ?? 'Task not found' },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json(task);
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
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
