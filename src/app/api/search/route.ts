import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchAllSources } from '@/lib/search';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { query, sources = ['gmail', 'calendar', 'drive', 'slack'], topic_id, date_from, date_to, max_results = 20, account_ids } = body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    const sanitizedQuery = query.trim().slice(0, 500); // Limit query length
    const safeMaxResults = Math.min(Math.max(1, max_results), 100); // Clamp 1-100

    // Fetch connected accounts info for the UI
    const [googleAccountsRes, slackAccountsRes, notionAccountsRes] = await Promise.all([
      supabase.from('google_accounts').select('id, email').eq('user_id', user.id),
      supabase.from('slack_accounts').select('id, team_name').eq('user_id', user.id),
      supabase.from('notion_accounts').select('id, workspace_name').eq('user_id', user.id),
    ]);

    // Filter out 'manual' and 'link' from external sources search (they are searched separately below)
    const externalSources = (sources as string[]).filter((s: string) => s !== 'manual' && s !== 'link');
    const results = externalSources.length > 0
      ? await searchAllSources(user.id, { query: sanitizedQuery, sources: externalSources, topic_id, date_from, date_to, max_results: safeMaxResults, account_ids })
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
        .or(`title.ilike.%${sanitizedQuery}%,snippet.ilike.%${sanitizedQuery}%`)
        .order('occurred_at', { ascending: false })
        .limit(safeMaxResults);

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
        .ilike('notes', `%${sanitizedQuery}%`)
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

    // Search linked URLs if 'link' source is selected
    if ((sources as string[]).includes('link')) {
      const { data: linkItems } = await supabase
        .from('topic_items')
        .select('id, title, snippet, url, metadata, occurred_at, topic_id, topics(title)')
        .eq('user_id', user.id)
        .eq('source', 'link')
        .or(`title.ilike.%${sanitizedQuery}%,snippet.ilike.%${sanitizedQuery}%,url.ilike.%${sanitizedQuery}%`)
        .order('occurred_at', { ascending: false })
        .limit(safeMaxResults);

      if (linkItems && linkItems.length > 0) {
        const linkResults = linkItems.map(item => ({
          external_id: item.url || item.id,
          source: 'link' as const,
          source_account_id: '',
          title: item.title,
          snippet: item.snippet || '',
          url: item.url || '',
          occurred_at: item.occurred_at,
          metadata: { ...(item.metadata as Record<string, unknown> || {}), topic_title: (item.topics as unknown as { title: string } | null)?.title || '' },
        }));

        (results as Array<{ source: string; items: typeof linkResults; error?: string }>).push({
          source: 'link',
          items: linkResults,
        });
      }
    }

    const accounts = {
      google: (googleAccountsRes.data ?? []).map(a => ({ id: a.id, email: a.email })),
      slack: (slackAccountsRes.data ?? []).map(a => ({ id: a.id, name: a.team_name })),
      notion: (notionAccountsRes.data ?? []).map(a => ({ id: a.id, name: a.workspace_name })),
    };

    return NextResponse.json({ results, accounts });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
