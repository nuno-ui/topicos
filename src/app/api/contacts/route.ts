import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get('sort') || 'name';
  const sortDir = searchParams.get('dir') === 'desc' ? false : true;
  const area = searchParams.get('area');
  const search = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

  let query = supabase
    .from('contacts')
    .select('*, contact_topic_links(topic_id, role, topics(title, status, area))')
    .eq('user_id', user.id);

  if (area && area !== 'all') query = query.eq('area', area);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,organization.ilike.%${search}%`);

  const validSorts = ['name', 'created_at', 'updated_at', 'interaction_count', 'last_interaction_at', 'organization'];
  const sortField = validSorts.includes(sortBy) ? sortBy : 'name';
  query = query.order(sortField, { ascending: sortDir }).limit(limit);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data, total: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, email, organization, role, notes, area, metadata } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (email && typeof email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const validAreas = ['work', 'personal', 'career'];
  const insertData: Record<string, unknown> = {
    name: name.trim(),
    email: email?.trim() || null,
    organization: organization?.trim() || null,
    role: role?.trim() || null,
    notes: notes?.trim() || null,
    user_id: user.id,
  };
  if (area && validAreas.includes(area)) insertData.area = area;
  if (metadata && typeof metadata === 'object') insertData.metadata = metadata;

  // Only use upsert with onConflict if email is provided (email is part of the unique constraint)
  let result;
  if (email?.trim()) {
    result = await supabase.from('contacts').upsert(
      insertData,
      { onConflict: 'user_id, email' }
    ).select().single();
  } else {
    result = await supabase.from('contacts').insert(insertData).select().single();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ contact: result.data }, { status: 201 });
}
