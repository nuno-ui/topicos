import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaudeJSON } from '@/lib/ai/provider';
import { searchAllSources } from '@/lib/search';
import { getTopicNoteContext } from '@/lib/ai/note-context';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { topic_id, contact_id, time_period, sources: requestedSources } = body;

    // Validate: exactly one of topic_id or contact_id
    if (!topic_id && !contact_id) return NextResponse.json({ error: 'Either topic_id or contact_id is required' }, { status: 400 });
    if (topic_id && contact_id) return NextResponse.json({ error: 'Provide only one of topic_id or contact_id' }, { status: 400 });

    // Validate time period
    const validPeriods = ['15d', '1m', '3m'] as const;
    if (!validPeriods.includes(time_period)) return NextResponse.json({ error: 'time_period must be 15d, 1m, or 3m' }, { status: 400 });

    // Compute date range
    const now = new Date();
    const daysMap = { '15d': 15, '1m': 30, '3m': 90 };
    const dateFrom = new Date(now.getTime() - daysMap[time_period as keyof typeof daysMap] * 24 * 60 * 60 * 1000);
    const dateFromFormatted = `${dateFrom.getFullYear()}/${String(dateFrom.getMonth() + 1).padStart(2, '0')}/${String(dateFrom.getDate()).padStart(2, '0')}`;
    const dateFromISO = dateFrom.toISOString().split('T')[0];

    // Default sources
    const activeSources: string[] = requestedSources && requestedSources.length > 0
      ? requestedSources
      : ['gmail', 'calendar', 'drive', 'slack', 'notion'];

    // --- Gather context & build exclusion set ---
    let entityType: 'topic' | 'contact' = 'topic';
    let entityName = '';
    let entityContext = '';
    const exclusionSet = new Set<string>();

    if (topic_id) {
      entityType = 'topic';
      const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
      if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

      entityName = topic.title;
      const noteContext = await getTopicNoteContext(topic_id);

      // Build exclusion set from existing linked items
      const { data: existingItems } = await supabase.from('topic_items')
        .select('external_id, source')
        .eq('topic_id', topic_id).eq('user_id', user.id);
      if (existingItems) {
        for (const item of existingItems) {
          exclusionSet.add(item.source + ':' + item.external_id);
        }
      }

      entityContext = `Topic: ${topic.title}
Description: ${topic.description || 'No description'}
Area: ${topic.area}
Tags: ${(topic.tags || []).join(', ') || 'None'}
Goal: ${topic.goal || 'Not set'}
Owner: ${topic.owner || 'Not set'}
Stakeholders: ${(topic.stakeholders || []).join(', ') || 'None'}
${existingItems && existingItems.length > 0 ? `\nAlready linked items (${existingItems.length} total) — DO NOT generate queries for these:\n${existingItems.slice(0, 15).map((i: { source: string; external_id: string }) => `- [${i.source}] ${i.external_id}`).join('\n')}` : ''}
${noteContext}`;

    } else if (contact_id) {
      entityType = 'contact';
      const { data: contact } = await supabase.from('contacts').select('*').eq('id', contact_id).eq('user_id', user.id).single();
      if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

      entityName = contact.name;

      // Build exclusion set from contact's linked topics + direct contact items
      const { data: contactTopicLinks } = await supabase.from('contact_topic_links')
        .select('topic_id')
        .eq('contact_id', contact_id);
      const linkedTopicIds = (contactTopicLinks || []).map((l: { topic_id: string }) => l.topic_id);

      if (linkedTopicIds.length > 0) {
        const { data: topicItems } = await supabase.from('topic_items')
          .select('external_id, source')
          .in('topic_id', linkedTopicIds)
          .eq('user_id', user.id);
        if (topicItems) {
          for (const item of topicItems) {
            exclusionSet.add(item.source + ':' + item.external_id);
          }
        }
      }

      const { data: contactItems } = await supabase.from('contact_items')
        .select('id, source')
        .eq('contact_id', contact_id);
      if (contactItems) {
        for (const item of contactItems) {
          exclusionSet.add(item.source + ':' + item.id);
        }
      }

      entityContext = `Contact: ${contact.name}
Email: ${contact.email || 'Unknown'}
Organization: ${contact.organization || 'Unknown'}
Role: ${contact.role || 'Unknown'}
Area: ${contact.area || 'Not set'}
Notes: ${contact.notes || 'None'}
Linked topics: ${linkedTopicIds.length} topics`;
    }

    // --- AI Query Generation ---
    const periodLabel = time_period === '15d' ? 'last 15 days' : time_period === '1m' ? 'last month' : 'last 3 months';

    const queryGenSystem = entityType === 'topic'
      ? `You are a search query generator. Given a topic/project and a time window (${periodLabel}), generate search queries to find recent items from connected sources that might be relevant to this topic but haven't been linked yet.

Use source-specific date operators to limit results to the ${periodLabel}:
- Gmail: Include "after:${dateFromFormatted}" in EVERY query. Use Gmail operators (from:, subject:, has:attachment, etc.)
- Slack: Include "after:${dateFromISO}" in EVERY query. Use Slack modifiers (from:, in:, etc.)
- Calendar: Simple keyword queries (date filtering handled by API)
- Drive: Simple keyword queries focusing on project names, deliverables, key terms
- Notion: Simple keyword queries for page titles and content

Generate 2-3 queries per source. Think about:
- Key people, companies, organizations involved
- Project names, acronyms, code names
- Deliverables, milestones, meeting names
- Related concepts the user might have missed

Return JSON: { "gmail_queries": [...], "calendar_queries": [...], "drive_queries": [...], "slack_queries": [...], "notion_queries": [...] }`

      : `You are a search query generator. Given a contact person and a time window (${periodLabel}), generate search queries to find ALL recent items involving or mentioning this person across connected sources.

Use source-specific date operators to limit results to the ${periodLabel}:
- Gmail: Include "after:${dateFromFormatted}" in EVERY query. Search by their email (from:email, to:email) AND by name
- Slack: Include "after:${dateFromISO}" in EVERY query. Search by name mentions and from:username
- Calendar: Search for their name and email in event attendees and titles
- Drive: Search for documents shared with, created by, or mentioning them
- Notion: Search for pages mentioning their name

Generate 2-3 queries per source. Be thorough — find conversations with, about, and mentioning this person.

Return JSON: { "gmail_queries": [...], "calendar_queries": [...], "drive_queries": [...], "slack_queries": [...], "notion_queries": [...] }`;

    const { data: queries } = await callClaudeJSON<{
      gmail_queries: string[];
      calendar_queries: string[];
      drive_queries: string[];
      slack_queries: string[];
      notion_queries: string[];
    }>(queryGenSystem, entityContext);

    // --- Execute Searches in Parallel ---
    type SearchResultItem = {
      external_id: string; source: string; source_account_id: string;
      title: string; snippet: string; url: string; occurred_at: string;
      metadata: Record<string, unknown>;
    };
    const allResults: SearchResultItem[] = [];
    const queriesUsed: Array<{ source: string; queries: string[] }> = [];

    const sourceQueryMap: Array<{ source: string; key: keyof typeof queries; searchSource: string }> = [
      { source: 'gmail', key: 'gmail_queries', searchSource: 'gmail' },
      { source: 'calendar', key: 'calendar_queries', searchSource: 'calendar' },
      { source: 'drive', key: 'drive_queries', searchSource: 'drive' },
      { source: 'slack', key: 'slack_queries', searchSource: 'slack' },
      { source: 'notion', key: 'notion_queries', searchSource: 'notion' },
    ];

    const searchPromises: Promise<void>[] = [];

    for (const { source, key, searchSource } of sourceQueryMap) {
      if (!activeSources.includes(searchSource)) continue;
      const sourceQueries = queries[key];
      if (sourceQueries?.length) {
        queriesUsed.push({ source, queries: sourceQueries });
        for (const q of sourceQueries) {
          searchPromises.push(
            searchAllSources(user.id, {
              query: q,
              sources: [searchSource],
              date_from: dateFrom.toISOString(),
              date_to: now.toISOString(),
              max_results: 15,
            })
              .then(results => {
                for (const r of results) {
                  allResults.push(...r.items);
                }
              })
              .catch(() => { /* continue on error */ })
          );
        }
      }
    }

    await Promise.all(searchPromises);

    // --- Deduplicate + Exclude already-linked + Date post-filter ---
    const seen = new Set<string>();
    const totalBeforeFilter = allResults.length;
    const dedupedResults = allResults.filter(r => {
      const key = r.source + ':' + r.external_id;
      if (seen.has(key) || exclusionSet.has(key)) return false;
      seen.add(key);
      // Post-filter by date (for Drive/Notion which lack native date filtering)
      if (r.occurred_at) {
        const itemDate = new Date(r.occurred_at);
        if (itemDate < dateFrom) return false;
      }
      return true;
    });

    // --- AI Ranking ---
    if (dedupedResults.length > 0) {
      const rankingSystem = `You are ranking search results by relevance to a ${entityType}. Score each result 0.0-1.0 and provide a brief reason why it's relevant.

The ${entityType} is: "${entityName}"

Score HIGHER if:
- Directly discusses the same subject, project, or person
- Involves the same people or organizations
- References related deliverables, meetings, or milestones
- Has clear topical or personal connection
- Is recent and actionable

Score LOWER if:
- Only tangentially related
- Generic or boilerplate content
- Automated notifications with low informational value

Only include results with score >= 0.3. Sort by score descending.
Return JSON: { "ranked": [{ "index": 0, "score": 0.95, "reason": "Brief explanation" }] }`;

      const rankingPrompt = `${entityType === 'topic' ? `Topic: ${entityName}` : `Contact: ${entityName}`}

Search Results (${dedupedResults.length} items from ${periodLabel}):
${dedupedResults.slice(0, 40).map((r, i) => `${i}. [${r.source}] ${r.title}\n   ${(r.snippet || '').substring(0, 250)}`).join('\n')}`;

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

        // Log AI run (non-critical)
        try {
          await supabase.from('ai_runs').insert({
            user_id: user.id,
            topic_id: topic_id || null,
            kind: 'review_recent_activity',
            model: 'claude-sonnet-4-5-20250929',
            input_summary: `Review ${periodLabel} for ${entityType} "${entityName}" — ${rankedResults.length} relevant results from ${totalBeforeFilter} raw`,
            output_json: {
              queries_used: queriesUsed,
              result_count: rankedResults.length,
              total_raw: totalBeforeFilter,
              total_deduped: dedupedResults.length,
              time_period,
              entity_type: entityType,
            },
          });
        } catch { /* non-critical logging */ }

        return NextResponse.json({
          results: rankedResults,
          queries_used: queriesUsed,
          time_range: { from: dateFrom.toISOString(), to: now.toISOString() },
          total_before_filter: totalBeforeFilter,
          entity_context: { type: entityType, name: entityName, id: topic_id || contact_id },
        });

      } catch {
        // If ranking fails, return unranked results
        return NextResponse.json({
          results: dedupedResults.map(r => ({ ...r, ai_confidence: null, ai_reason: null })),
          queries_used: queriesUsed,
          time_range: { from: dateFrom.toISOString(), to: now.toISOString() },
          total_before_filter: totalBeforeFilter,
          entity_context: { type: entityType, name: entityName, id: topic_id || contact_id },
        });
      }
    }

    return NextResponse.json({
      results: [],
      queries_used: queriesUsed,
      time_range: { from: dateFrom.toISOString(), to: now.toISOString() },
      total_before_filter: totalBeforeFilter,
      entity_context: { type: entityType, name: entityName, id: topic_id || contact_id },
    });

  } catch (err) {
    console.error('Review activity error:', err);
    return NextResponse.json(
      { error: 'Review activity failed: ' + (err instanceof Error ? err.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
