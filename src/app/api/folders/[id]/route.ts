import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Validate name if provided
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
    return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
  }
  if (body.name !== undefined && body.name.trim().length > 100) {
    return NextResponse.json({ error: 'Folder name must be 100 characters or less' }, { status: 400 });
  }

  // Validate area if provided
  if (body.area !== undefined && body.area !== null && !['work', 'personal', 'career'].includes(body.area)) {
    return NextResponse.json({ error: 'Area must be work, personal, or career' }, { status: 400 });
  }

  // Build safe update data — only allow known fields
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.parent_id !== undefined) updateData.parent_id = body.parent_id || null;
  if (body.color !== undefined) updateData.color = body.color || null;
  if (body.icon !== undefined) updateData.icon = body.icon || null;
  if (body.position !== undefined) updateData.position = body.position;
  if (body.area !== undefined) updateData.area = body.area || null;

  let { data, error } = await supabase
    .from('folders')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  // If schema cache error, retry without new columns (area/color/icon may not exist yet)
  if (error && error.message.includes('schema cache')) {
    console.warn('PATCH /api/folders/[id]: new columns not in schema, retrying without area/color/icon');
    const safeData: Record<string, unknown> = { updated_at: updateData.updated_at };
    if (updateData.name !== undefined) safeData.name = updateData.name;
    if (updateData.parent_id !== undefined) safeData.parent_id = updateData.parent_id;
    if (updateData.position !== undefined) safeData.position = updateData.position;
    const retry = await supabase
      .from('folders')
      .update(safeData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folder: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Move topics in this folder to no folder
  await supabase
    .from('topics')
    .update({ folder_id: null })
    .eq('folder_id', id)
    .eq('user_id', user.id);

  // Move subfolders to parent of deleted folder
  const { data: folder } = await supabase
    .from('folders')
    .select('parent_id')
    .eq('id', id)
    .single();

  await supabase
    .from('folders')
    .update({ parent_id: folder?.parent_id || null })
    .eq('parent_id', id)
    .eq('user_id', user.id);

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
