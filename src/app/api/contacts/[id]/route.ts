import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, contact_topic_links(id, topic_id, role, created_at, topics(title, status, due_date, priority, area, updated_at, tags))')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json({ contact: data });
  } catch (err) {
    console.error('GET /api/contacts/[id] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, email, organization, role, notes, area, is_favorite } = body;

    // Validate fields if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    if (email !== undefined && email && typeof email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    const validAreas = ['work', 'personal', 'career'];
    if (area !== undefined && area !== null && !validAreas.includes(area)) {
      return NextResponse.json({ error: 'Area must be work, personal, or career' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (organization !== undefined) updateData.organization = organization?.trim() || null;
    if (role !== undefined) updateData.role = role?.trim() || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (area !== undefined) updateData.area = area || null;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;
    if (body.last_interaction_at !== undefined) updateData.last_interaction_at = body.last_interaction_at;
    if (body.interaction_count !== undefined) updateData.interaction_count = body.interaction_count;
    if (body.is_favorite !== undefined) updateData.is_favorite = !!body.is_favorite;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Try update with all fields first
    let { data, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    // If the 'area' column doesn't exist yet (schema cache error), retry without it
    if (error && error.message.includes('schema cache') && updateData.area !== undefined) {
      console.warn('PATCH /api/contacts/[id]: area column not in schema, retrying without it');
      const { area: _area, ...withoutArea } = updateData;
      if (Object.keys(withoutArea).length > 0) {
        const retry = await supabase
          .from('contacts')
          .update(withoutArea)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      } else {
        return NextResponse.json({ error: 'Area column not yet available. Please run migration 008.' }, { status: 400 });
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json({ contact: data });
  } catch (err) {
    console.error('PATCH /api/contacts/[id] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // First delete contact_topic_links for this contact
    await supabase
      .from('contact_topic_links')
      .delete()
      .eq('contact_id', id)
      .eq('user_id', user.id);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/contacts/[id] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
