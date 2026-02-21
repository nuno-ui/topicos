import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { contact_id, area, label, expires_in_days } = body;

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    contact_id: contact_id || null,
    area: area || 'work',
    label: label || null,
  };

  if (expires_in_days) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    insertData.expires_at = expiresAt.toISOString();
  }

  const { data, error } = await supabase
    .from('share_links')
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${data.token}`;

  return NextResponse.json({ shareLink: data, shareUrl }, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const contactId = url.searchParams.get('contact_id');

  let query = supabase
    .from('share_links')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (contactId) {
    query = query.eq('contact_id', contactId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ shareLinks: data });
}
