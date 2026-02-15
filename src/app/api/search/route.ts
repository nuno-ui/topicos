import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchAllSources } from '@/lib/search';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { query, sources = ['gmail', 'calendar', 'drive', 'slack'], topic_id, date_from, date_to, max_results } = body;
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    // Filter out 'manual' from external sources search
    const externalSources = (sources as string[]).filter((s: string) => s !== 'manual');
    const results = externalSources.length > 0
      ? await searchAllSources(user.id, { query, sources: externalSources, topic_id, date_from, date_to, max_results })
      : [];

    // Search notes if 'manual' source is selected
    if ((sources as string[]).includes('manual')) {
      const noteResults: { external_id: string; source: string; source_account_id: string; title: string; snippet: string; url: string; occurred_at: string; metadata: Record<string, unknown> }[] = [];

      // Search manual topic_items (individual notes)
      const { data: noteItems } = await supabase
        .from('topic_items')
        .select('id, title, snippet, metadata, occurred_at, topic_id, topics(title)')
        .eq('user_id', user.id)
        .eq('source', 'manual')
        .or(`title.ilike.%${query}%,snippet.ilike.%${query}%`)
        .order('occurred_at', { ascending: false })
        .limit(max_results || 20);

      if (noteItems && noteItems.length > 0) {
        for (const item of noteItems) {
          const topicTitle = (item.topics as unknown as { title: string } | null)?.title || '';
          noteResults.push({
            external_id: item.id,
            source: 'manual',
            source_account_id: '',
            title: item.title,
            snippet: item.snippet || '',
            url: `/topics/${item.topic_id}`,
            occurred_at: item.occurred_at,
            metadata: { ...(item.metadata as Record<string, unknown> || {}), topic_title: topicTitle },
          });
        }
      }

      // Also search topics.notes field (quick notes scratchpad)
      const { data: topicNotes } = await supabase
        .from('topics')
        .select('id, title, notes, updated_at')
        .eq('user_id', user.id)
        .not('notes', 'is', null)
        .ilike('notes', `%${query}%`)
        .limit(10);

      if (topicNotes && topicNotes.length > 0) {
        for (const t of topicNotes) {
          noteResults.push({
            external_id: `quicknotes:${t.id}`,
            source: 'manual',
            source_account_id: '',
            title: `Quick Notes: ${t.title}`,
            snippet: (t.notes || '').substring(0, 200),
            url: `/topics/${t.id}`,
            occurred_at: t.updated_at,
            metadata: { type: 'quick_notes', topic_id: t.id },
          });
        }
      }

      if (noteResults.length > 0) {
        (results as Array<{ source: string; items: typeof noteResults; error?: string }>).push({
          source: 'manual',
          items: noteResults,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
