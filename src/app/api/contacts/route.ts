import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('contacts')
    .select('*, contact_topic_links(topic_id, role, topics(title))')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, email, organization, role, notes, area, metadata } = body;
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const insertData: Record<string, unknown> = {
    name,
    email: email || null,
    organization: organization || null,
    role: role || null,
    notes: notes || null,
    user_id: user.id,
  };
  if (area) insertData.area = area;
  if (metadata) insertData.metadata = metadata;

  const { data, error } = await supabase.from('contacts').upsert(
    insertData,
    { onConflict: 'user_id, email' }
  ).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 201 });
}
