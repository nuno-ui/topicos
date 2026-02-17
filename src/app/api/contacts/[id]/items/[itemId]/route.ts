import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.body !== undefined) {
      updateData.body = body.body || null;
      // Re-generate snippet from body
      updateData.snippet = body.body ? String(body.body).replace(/[#*_`>\-\[\]()]/g, '').substring(0, 200) : '';
    }
    if (body.url !== undefined) updateData.url = body.url?.trim() || '';
    if (body.metadata !== undefined) updateData.metadata = body.metadata;
    if (body.occurred_at !== undefined) updateData.occurred_at = body.occurred_at;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contact_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('PATCH /api/contacts/[id]/items/[itemId] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { error } = await supabase
      .from('contact_items')
      .delete()
      .eq('id', itemId)
      .eq('contact_id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/contacts/[id]/items/[itemId] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
