import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaudeJSON } from '@/lib/ai/provider';
import { searchAllSources } from '@/lib/search';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { topic_id } = body;
    if (!topic_id) return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });

    // 1. Get topic with existing items and contacts
    const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const { data: existingItems } = await supabase.from('topic_items').select('title, source, external_id').eq('topic_id', topic_id);

    // 2. Generate search queries using AI
    const system = `You are a search query generator. Given a topic/project description, generate optimal search queries for each data source to find relevant communications, events, and files.

Generate search queries that would find emails, calendar events, Drive files, and Slack messages related to this topic. Use source-specific syntax:
- Gmail: Use Gmail search operators (from:, subject:, after:, has:attachment, etc.)
- Calendar: Simple keyword queries
- Drive: Simple keyword queries
- Slack: Use Slack search modifiers (from:, in:, during:, etc.)

Return 2-3 queries per source, from most specific to broader.

Return JSON format:
{
  "gmail_queries": ["query1", "query2"],
  "calendar_queries": ["query1", "query2"],
  "drive_queries": ["query1", "query2"],
  "slack_queries": ["query1", "query2"]
}`;

    const context = `Topic: ${topic.title}
Description: ${topic.description || 'No description'}
Area: ${topic.area}
Tags: ${(topic.tags || []).join(', ') || 'None'}
${existingItems && existingItems.length > 0 ? `\nAlready linked items:\n${existingItems.map((i: { title: string; source: string }) => `- [${i.source}] ${i.title}`).join('\n')}` : ''}`;

    const { data: queries } = await callClaudeJSON<{
      gmail_queries: string[];
      calendar_queries: string[];
      drive_queries: string[];
      slack_queries: string[];
    }>(system, context);

    // 3. Execute searches in parallel for each query
    const allResults: Array<{ external_id: string; source: string; source_account_id: string; title: string; snippet: string; url: string; occurred_at: string; metadata: Record<string, unknown> }> = [];
    const queriesUsed: Array<{ source: string; queries: string[] }> = [];

    // Search Gmail
    if (queries.gmail_queries?.length) {
      queriesUsed.push({ source: 'gmail', queries: queries.gmail_queries });
      for (const q of queries.gmail_queries) {
        try {
          const results = await searchAllSources(user.id, { query: q, sources: ['gmail'], topic_id, max_results: 10 });
          for (const r of results) {
            allResults.push(...r.items);
          }
        } catch { /* continue */ }
      }
    }

    // Search Calendar
    if (queries.calendar_queries?.length) {
      queriesUsed.push({ source: 'calendar', queries: queries.calendar_queries });
      for (const q of queries.calendar_queries) {
        try {
          const results = await searchAllSources(user.id, { query: q, sources: ['calendar'], topic_id, max_results: 10 });
          for (const r of results) {
            allResults.push(...r.items);
          }
        } catch { /* continue */ }
      }
    }

    // Search Drive
    if (queries.drive_queries?.length) {
      queriesUsed.push({ source: 'drive', queries: queries.drive_queries });
      for (const q of queries.drive_queries) {
        try {
          const results = await searchAllSources(user.id, { query: q, sources: ['drive'], topic_id, max_results: 10 });
          for (const r of results) {
            allResults.push(...r.items);
          }
        } catch { /* continue */ }
      }
    }

    // Search Slack
    if (queries.slack_queries?.length) {
      queriesUsed.push({ source: 'slack', queries: queries.slack_queries });
      for (const q of queries.slack_queries) {
        try {
          const results = await searchAllSources(user.id, { query: q, sources: ['slack'], topic_id, max_results: 10 });
          for (const r of results) {
            allResults.push(...r.items);
          }
        } catch { /* continue */ }
      }
    }

    // 4. Deduplicate
    const seen = new Set<string>();
    const existingIds = new Set((existingItems || []).map((i: { source: string; external_id: string }) => i.source + ':' + i.external_id));
    const dedupedResults = allResults.filter(r => {
      const key = r.source + ':' + r.external_id;
      if (seen.has(key) || existingIds.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 5. If we have results, use AI to rank them by relevance
    if (dedupedResults.length > 0) {
      const rankingSystem = `You are ranking search results by relevance to a topic. Score each result 0-1 and provide a brief reason.

Return JSON:
{
  "ranked": [
    { "index": 0, "score": 0.95, "reason": "Directly discusses the marketing budget" },
    ...
  ]
}

Only include results with score >= 0.3. Sort by score descending.`;

      const rankingPrompt = `Topic: ${topic.title}
Description: ${topic.description || 'None'}

Search Results:
${dedupedResults.slice(0, 30).map((r, i) => `${i}. [${r.source}] ${r.title} — ${r.snippet}`).join('\n')}`;

      try {
        const { data: ranking } = await callClaudeJSON<{
          ranked: Array<{ index: number; score: number; reason: string }>;
        }>(rankingSystem, rankingPrompt);

        const rankedResults = ranking.ranked
          .filter(r => r.index >= 0 && r.index < dedupedResults.length)
          .map(r => ({
            ...dedupedResults[r.index],
            ai_confidence: r.score,
            ai_reason: r.reason,
          }));

        // Log AI run
        await supabase.from('ai_runs').insert({
          user_id: user.id,
          topic_id: topic.id,
          kind: 'ai_find',
          model: 'claude-sonnet-4-5-20250929',
          input_summary: `Generated queries for "${topic.title}" and searched ${allResults.length} results, ranked ${rankedResults.length}`,
          output_json: { queries_used: queriesUsed, result_count: rankedResults.length },
        });

        return NextResponse.json({ results: rankedResults, queries_used: queriesUsed });
      } catch {
        // If ranking fails, return unranked
        return NextResponse.json({ results: dedupedResults.map(r => ({ ...r, ai_confidence: null, ai_reason: null })), queries_used: queriesUsed });
      }
    }

    return NextResponse.json({ results: [], queries_used: queriesUsed });
  } catch (err) {
    console.error('AI find error:', err);
    return NextResponse.json({ error: 'AI Find failed: ' + (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
