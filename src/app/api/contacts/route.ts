import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/contacts - List contacts with optional filters
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const area = searchParams.get('area');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') ?? '100');

  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('interaction_count', { ascending: false })
    .limit(limit);

  if (area) query = query.eq('area', area);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,organization.ilike.%${search}%`);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/contacts - Create a contact manually
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { email, name, organization, role, area, notes } = body;

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('contacts')
    .upsert({
      user_id: user.id,
      email: email.toLowerCase(),
      name,
      organization,
      role,
      area,
      notes,
      metadata: {},
    }, { onConflict: 'user_id,email' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
