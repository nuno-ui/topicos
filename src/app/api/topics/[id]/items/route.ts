import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enrichAndCacheItemContent } from '@/lib/search/content';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify topic ownership
  const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('topic_items')
    .select('*')
    .eq('topic_id', id)
    .order('occurred_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify topic ownership
  const { data: topic } = await supabase.from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  const body = await request.json();
  const { external_id, source, source_account_id, title, snippet, url, occurred_at, metadata, linked_by, confidence, link_reason } = body;

  // Duplicate detection: check if same external_id + source exists in ANY topic for this user
  if (external_id && source) {
    const { data: existing } = await supabase
      .from('topic_items')
      .select('id, topic_id, topics!inner(title)')
      .eq('external_id', external_id)
      .eq('source', source)
      .eq('user_id', user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      const existingItem = existing[0];
      const existingTopic = (existingItem.topics as unknown as { title: string })?.title || 'another topic';
      // Check if it's in the SAME topic (exact duplicate)
      if (existingItem.topic_id === id) {
        return NextResponse.json({
          error: 'This item is already linked to this topic',
          duplicate: true,
          same_topic: true,
        }, { status: 409 });
      }
      // It's in a different topic — warn but allow linking
      // The frontend can show a warning dialog
      const checkOnly = body.check_only === true;
      if (checkOnly) {
        return NextResponse.json({
          duplicate: true,
          same_topic: false,
          existing_topic_id: existingItem.topic_id,
          existing_topic_name: existingTopic,
        });
      }
      // If not check_only, continue with linking (user confirmed)
    }
  }

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    topic_id: id,
    external_id,
    source,
    source_account_id: source_account_id || null,
    title,
    snippet: snippet || '',
    url: url || '',
    occurred_at: occurred_at || new Date().toISOString(),
    metadata: metadata || {},
  };

  // Add optional fields if they exist in the schema
  if (linked_by) insertData.linked_by = linked_by;
  if (confidence != null) insertData.confidence = confidence;
  if (link_reason) insertData.link_reason = link_reason;

  const { data, error } = await supabase.from('topic_items').insert(insertData).select().single();

  if (error) {
    console.error('Topic item insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update topic updated_at
  // Best-effort: update parent topic timestamp
  await supabase.from('topics').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);

  // Auto-enrich content for sources that have fetchable content (notion, gmail, drive, slack, link)
  // This runs in the background so the response is fast, but content is available for AI agents
  if (data && ['notion', 'gmail', 'drive', 'slack', 'link'].includes(source)) {
    enrichAndCacheItemContent(user.id, {
      id: data.id,
      topic_id: id,
      source: data.source,
      source_account_id: data.source_account_id,
      external_id: data.external_id,
      body: null,
      metadata: data.metadata as Record<string, unknown>,
    }).catch(err => console.error(`Auto-enrich failed for ${source}/${external_id}:`, err));
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
