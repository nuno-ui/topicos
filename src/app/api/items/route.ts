import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

/* ---------- GET ---------- */

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const linked = searchParams.get('linked'); // 'true' | 'false'
  const search = searchParams.get('search');

  let query = supabase
    .from('items')
    .select('*')
    .order('occurred_at', { ascending: false });

  // Filter by source
  if (source) {
    const sourceSchema = z.enum(['gmail', 'calendar', 'drive', 'manual']);
    const parsed = sourceSchema.safeParse(source);
    if (parsed.success) {
      query = query.eq('source', parsed.data);
    } else {
      return NextResponse.json(
        { error: 'source must be one of: gmail, calendar, drive, manual' },
        { status: 400 }
      );
    }
  }

  // Text search on title/snippet
  if (search) {
    query = query.or(`title.ilike.%${search}%,snippet.ilike.%${search}%`);
  }

  const { data: items, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by linked/unlinked status if requested
  if (linked === 'true' || linked === 'false') {
    const { data: topicLinks, error: linkError } = await supabase
      .from('topic_links')
      .select('item_id');

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const linkedItemIds = new Set(
      (topicLinks ?? []).map((link) => link.item_id)
    );

    const filtered = linked === 'true'
      ? (items ?? []).filter((item) => linkedItemIds.has(item.id))
      : (items ?? []).filter((item) => !linkedItemIds.has(item.id));

    return NextResponse.json(filtered);
  }

  return NextResponse.json(items);
}

/* ---------- POST ---------- */

const createItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  snippet: z.string().max(2000).optional().nullable(),
  body: z.string().max(50000).optional().nullable(),
  url: z.string().url().optional().nullable(),
  occurred_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
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

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { title, snippet, body: itemBody, url, occurred_at, metadata } = parsed.data;

  const { data: item, error } = await supabase
    .from('items')
    .insert({
      user_id: user.id,
      account_id: null,
      source: 'manual' as const,
      external_id: null,
      title,
      snippet: snippet ?? null,
      body: itemBody ?? null,
      url: url ?? null,
      occurred_at: occurred_at ?? new Date().toISOString(),
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(item, { status: 201 });
}
