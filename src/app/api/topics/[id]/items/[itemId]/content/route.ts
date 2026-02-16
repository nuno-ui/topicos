import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enrichAndCacheItemContent } from '@/lib/search/content';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify topic ownership
  const { data: topic } = await supabase
    .from('topics').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  // Get the item
  const { data: item } = await supabase
    .from('topic_items')
    .select('*')
    .eq('id', itemId)
    .eq('topic_id', id)
    .single();
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // If body already cached, return it immediately
  if (item.body && item.body.length > 0) {
    return NextResponse.json({
      body: item.body,
      cached: true,
      attachments: item.metadata?.attachment_names || [],
    });
  }

  // Fetch and cache content
  try {
    const result = await enrichAndCacheItemContent(user.id, item);
    return NextResponse.json({
      body: result.body || '',
      cached: false,
      attachments: result.attachments || [],
      extra_metadata: result.extra_metadata || {},
    });
  } catch (err) {
    console.error('Content fetch error:', err);
    return NextResponse.json({
      error: 'Failed to fetch content',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
