import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enrichTopicItems } from '@/lib/search/content';

/**
 * POST /api/topics/[id]/enrich
 * Re-enrich all topic items that don't have body content.
 * This fetches full content from source APIs (Notion, Gmail, Drive, Slack)
 * and stores it in the topic_items.body field for AI analysis.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Verify topic ownership
    const { data: topic } = await supabase.from('topics').select('id, title').eq('id', id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const result = await enrichTopicItems(user.id, id);

    return NextResponse.json({
      enriched: result.enriched,
      failed: result.failed,
      total: result.items.length,
    });
  } catch (err) {
    console.error('POST /api/topics/[id]/enrich error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Enrichment failed' }, { status: 500 });
  }
}
