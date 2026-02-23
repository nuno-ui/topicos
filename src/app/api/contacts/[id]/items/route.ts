import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    let query = supabase
      .from('contact_items')
      .select('*')
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (source) query = query.eq('source', source);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    console.error('GET /api/contacts/[id]/items error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Verify contact ownership
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const body = await request.json();
    const { source, title, body: itemBody, url, occurred_at, metadata } = body;

    // Validate
    const validSources = ['manual', 'link', 'document', 'notion', 'transcript'];
    if (!source || !validSources.includes(source)) {
      return NextResponse.json({ error: 'Source must be one of: manual, link, document, notion, transcript' }, { status: 400 });
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Auto-generate snippet from body
    const snippet = itemBody ? String(itemBody).replace(/[#*_`>\-\[\]()]/g, '').substring(0, 200) : '';

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      contact_id: id,
      source,
      title: title.trim(),
      snippet,
      body: itemBody || null,
      url: url?.trim() || '',
      occurred_at: occurred_at || new Date().toISOString(),
      metadata: metadata || {},
    };

    const { data, error } = await supabase
      .from('contact_items')
      .insert(insertData)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/contacts/[id]/items error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
