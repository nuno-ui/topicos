import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('contacts')
    .select('*, contact_topic_links(topic_id, role, topics(title))')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  return NextResponse.json({ contact: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, email, organization, role, notes, area } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email || null;
  if (organization !== undefined) updateData.organization = organization || null;
  if (role !== undefined) updateData.role = role || null;
  if (notes !== undefined) updateData.notes = notes || null;
  if (area !== undefined) updateData.area = area || null;

  const { data, error } = await supabase
    .from('contacts')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}
