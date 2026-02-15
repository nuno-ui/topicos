import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaude, callClaudeJSON } from '@/lib/ai/provider';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { agent, context } = body;
    if (!agent) return NextResponse.json({ error: 'Agent type required' }, { status: 400 });

    let result: Record<string, unknown> = {};

    switch (agent) {
      // ============ TOPIC PAGE AGENTS ============

      case 'auto_tag': {
        // AI generates tags for a topic based on its content
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet').eq('topic_id', topic_id).limit(20);
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { data } = await callClaudeJSON<{ tags: string[]; area: string; priority: number }>(
          'Generate relevant tags, suggest the best area (work/personal/career), and priority (1-5) for this topic. Return JSON: { "tags": ["tag1", "tag2", ...], "area": "work|personal|career", "priority": 1-5 }',
          `Topic: ${topic.title}\nDescription: ${topic.description || 'None'}\nItems:\n${(items || []).map((i: { source: string; title: string }) => `[${i.source}] ${i.title}`).join('\n')}`
        );

        await supabase.from('topics').update({
          tags: data.tags,
          area: data.area,
          priority: data.priority,
          updated_at: new Date().toISOString(),
        }).eq('id', topic_id);

        result = { tags: data.tags, area: data.area, priority: data.priority };
        break;
      }

      case 'suggest_title': {
        // AI suggests a better title for a topic
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        const { data: items } = await supabase.from('topic_items').select('title, source').eq('topic_id', topic_id).limit(10);
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { data } = await callClaudeJSON<{ suggestions: string[] }>(
          'Suggest 3 clear, concise titles for this topic based on its content. Return JSON: { "suggestions": ["Title 1", "Title 2", "Title 3"] }',
          `Current: ${topic.title}\nDescription: ${topic.description || 'None'}\nItems:\n${(items || []).map((i: { source: string; title: string }) => `[${i.source}] ${i.title}`).join('\n')}`
        );

        result = { suggestions: data.suggestions };
        break;
      }

      case 'generate_description': {
        // AI generates a rich description for a topic
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet').eq('topic_id', topic_id).limit(15);
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { text } = await callClaude(
          'Write a concise but comprehensive description (2-4 sentences) for this topic/project that captures its essence, key participants, and objectives.',
          `Topic: ${topic.title}\nCurrent description: ${topic.description || 'None'}\nItems:\n${(items || []).map((i: { source: string; title: string; snippet: string }) => `[${i.source}] ${i.title}: ${i.snippet || ''}`).join('\n')}`
        );

        result = { description: text };
        break;
      }

      case 'extract_action_items': {
        // AI extracts action items from topic communications
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet, metadata').eq('topic_id', topic_id).limit(20);
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { data } = await callClaudeJSON<{ action_items: Array<{ task: string; assignee: string; due: string; priority: string }> }>(
          'Extract all action items, tasks, and commitments from these communications. Return JSON: { "action_items": [{ "task": "...", "assignee": "person or unknown", "due": "date or TBD", "priority": "high|medium|low" }] }',
          `Topic: ${topic.title}\nItems:\n${(items || []).map((i: { source: string; title: string; snippet: string; metadata: Record<string, unknown> }) => {
            const meta = i.metadata || {};
            return `[${i.source}] ${i.title}\n${i.snippet || ''}\nFrom: ${meta.from || 'unknown'}\nTo: ${meta.to || 'unknown'}`;
          }).join('\n---\n')}`
        );

        result = { action_items: data.action_items };
        break;
      }

      case 'summarize_thread': {
        // AI summarizes all communications in a topic
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        const { data: items } = await supabase.from('topic_items').select('*').eq('topic_id', topic_id).order('occurred_at', { ascending: true }).limit(30);
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { text } = await callClaude(
          'Create a chronological executive summary of this topic\'s communications. Highlight key decisions, commitments, and open questions. Be concise but thorough.',
          `Topic: ${topic.title}\nDescription: ${topic.description || 'None'}\n\nCommunications (chronological):\n${(items || []).map((i: Record<string, unknown>) => {
            const meta = i.metadata as Record<string, unknown> || {};
            return `[${i.occurred_at}] [${i.source}] ${i.title}\n${i.snippet || ''}\nFrom: ${meta.from || ''} To: ${meta.to || ''}`;
          }).join('\n---\n')}`
        );

        result = { summary: text };
        break;
      }

      // ============ DASHBOARD AGENTS ============

      case 'daily_briefing': {
        // AI generates a daily briefing
        const { data: topics } = await supabase.from('topics').select('id, title, description, due_date, status, priority, summary, tags')
          .eq('user_id', user.id).eq('status', 'active').order('priority', { ascending: false }).limit(10);
        const { data: recentItems } = await supabase.from('topic_items').select('title, source, occurred_at, topics(title)')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);

        const { text } = await callClaude(
          'You are an executive assistant. Generate a concise daily briefing for the user. Include: 1) Priority items needing attention today, 2) Key updates from recent activity, 3) Upcoming deadlines, 4) Suggested focus areas. Keep it brief and actionable.',
          `Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n\nActive Topics:\n${(topics || []).map((t: Record<string, unknown>) => `- ${t.title} (priority: ${t.priority || 0}, due: ${t.due_date || 'none'}, tags: ${(t.tags as string[] || []).join(', ')})\n  Summary: ${(t.summary as string || 'No summary').substring(0, 200)}`).join('\n')}\n\nRecent Items:\n${(recentItems || []).map((i: Record<string, unknown>) => `- [${i.source}] ${i.title} (${i.occurred_at})`).join('\n')}`
        );

        result = { briefing: text };
        break;
      }

      case 'suggest_topics': {
        // AI suggests new topics based on uncategorized activity
        const { data: recentItems } = await supabase.from('topic_items').select('title, source, snippet')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
        const { data: topics } = await supabase.from('topics').select('title, description')
          .eq('user_id', user.id).eq('status', 'active');

        const { data } = await callClaudeJSON<{ suggestions: Array<{ title: string; description: string; area: string; reason: string }> }>(
          'Based on recent activity patterns, suggest 3-5 new topics the user should create to organize their work. Avoid duplicating existing topics. Return JSON: { "suggestions": [{ "title": "...", "description": "...", "area": "work|personal|career", "reason": "..." }] }',
          `Existing topics:\n${(topics || []).map((t: { title: string }) => `- ${t.title}`).join('\n')}\n\nRecent items:\n${(recentItems || []).map((i: { source: string; title: string }) => `[${i.source}] ${i.title}`).join('\n')}`
        );

        result = { suggestions: data.suggestions };
        break;
      }

      case 'weekly_review': {
        // AI generates a weekly review
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentItems } = await supabase.from('topic_items').select('title, source, occurred_at, topics(title)')
          .eq('user_id', user.id).gte('created_at', oneWeekAgo).order('created_at', { ascending: false }).limit(50);
        const { data: topics } = await supabase.from('topics').select('title, status, updated_at, summary')
          .eq('user_id', user.id).gte('updated_at', oneWeekAgo);
        const { data: aiRuns } = await supabase.from('ai_runs').select('kind, input_summary, created_at')
          .eq('user_id', user.id).gte('created_at', oneWeekAgo);

        const { text } = await callClaude(
          'Generate a weekly review summary. Include: 1) Key accomplishments, 2) Topics that progressed, 3) Items that need follow-up, 4) Productivity stats, 5) Priorities for next week.',
          `Week of ${new Date(oneWeekAgo).toLocaleDateString()} - ${new Date().toLocaleDateString()}\n\nItems processed: ${(recentItems || []).length}\nTopics updated: ${(topics || []).length}\nAI runs: ${(aiRuns || []).length}\n\nRecent items:\n${(recentItems || []).map((i: Record<string, unknown>) => `[${i.source}] ${i.title} → ${(i.topics as {title: string} | null)?.title || 'Unlinked'}`).join('\n')}\n\nUpdated topics:\n${(topics || []).map((t: Record<string, unknown>) => `- ${t.title} (${t.status})`).join('\n')}`
        );

        result = { review: text };
        break;
      }

      // ============ SEARCH AGENTS ============

      case 'smart_search': {
        // AI enhances a search query for better results
        const { query } = context;
        const { data } = await callClaudeJSON<{ enhanced_queries: Array<{ query: string; sources: string[]; reason: string }> }>(
          'Given a natural language search, generate optimized search queries for each source. Return JSON: { "enhanced_queries": [{ "query": "optimized query", "sources": ["gmail", "calendar", "drive", "slack", "notion"], "reason": "why this query" }] }',
          `User search: "${query}"`
        );

        result = { enhanced_queries: data.enhanced_queries };
        break;
      }

      case 'categorize_results': {
        // AI categorizes search results and suggests topics
        const { results } = context;
        const { data: topics } = await supabase.from('topics').select('id, title').eq('user_id', user.id).eq('status', 'active');

        const { data } = await callClaudeJSON<{ categorized: Array<{ result_index: number; suggested_topic_id: string | null; suggested_topic_name: string; confidence: number }> }>(
          'Categorize these search results and suggest which existing topic each belongs to. Return JSON: { "categorized": [{ "result_index": 0, "suggested_topic_id": "uuid or null", "suggested_topic_name": "topic name", "confidence": 0.0-1.0 }] }',
          `Existing topics:\n${(topics || []).map((t: { id: string; title: string }) => `${t.id}: ${t.title}`).join('\n')}\n\nSearch results:\n${(results || []).map((r: { title: string; source: string; snippet: string }, i: number) => `${i}. [${r.source}] ${r.title} — ${r.snippet}`).join('\n')}`
        );

        result = { categorized: data.categorized };
        break;
      }

      // ============ CONTACTS AGENTS ============

      case 'enrich_contact': {
        // AI enriches a contact profile
        const { contact_id } = context;
        const { data: contact } = await supabase.from('contacts').select('*').eq('id', contact_id).eq('user_id', user.id).single();
        if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        const { data: interactions } = await supabase.from('topic_items').select('title, source, snippet, occurred_at, metadata')
          .eq('user_id', user.id).limit(50);

        // Find items mentioning this contact
        const contactItems = (interactions || []).filter((i: Record<string, unknown>) => {
          const meta = i.metadata as Record<string, string> || {};
          const contactStr = JSON.stringify(meta).toLowerCase();
          return contactStr.includes((contact.email || '').toLowerCase()) || contactStr.includes((contact.name || '').toLowerCase());
        });

        const { data } = await callClaudeJSON<{ organization: string; role: string; relationship_summary: string; interaction_frequency: string; key_topics: string[] }>(
          'Based on communications, enrich this contact profile. Return JSON: { "organization": "...", "role": "estimated role", "relationship_summary": "brief description", "interaction_frequency": "daily|weekly|monthly|rare", "key_topics": ["topic1", "topic2"] }',
          `Contact: ${contact.name} <${contact.email}>\nCurrent org: ${contact.organization || 'unknown'}\n\nRelevant communications:\n${contactItems.slice(0, 20).map((i: Record<string, unknown>) => `[${i.source}] ${i.title}: ${i.snippet || ''}`).join('\n')}`
        );

        await supabase.from('contacts').update({
          organization: data.organization || contact.organization,
          notes: data.relationship_summary,
        }).eq('id', contact_id);

        result = data;
        break;
      }

      case 'find_contacts': {
        // AI extracts contacts from topic items
        const { topic_id } = context;
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet, metadata')
          .eq('topic_id', topic_id).limit(20);

        const { data } = await callClaudeJSON<{ contacts: Array<{ name: string; email: string; role: string }> }>(
          'Extract all people mentioned in these communications. Return JSON: { "contacts": [{ "name": "Full Name", "email": "email@example.com", "role": "their apparent role" }] }',
          `Items:\n${(items || []).map((i: Record<string, unknown>) => {
            const meta = i.metadata as Record<string, unknown> || {};
            return `[${i.source}] ${i.title}\nFrom: ${meta.from || ''}\nTo: ${meta.to || ''}\nAttendees: ${(meta.attendees as string[] || []).join(', ')}`;
          }).join('\n---\n')}`
        );

        result = { contacts: data.contacts };
        break;
      }

      // ============ SEARCH AGENTS (additional) ============

      case 'summarize_results': {
        // AI summarizes search results into a coherent overview
        const { query: searchQuery, results: searchResults } = context;
        const { text } = await callClaude(
          'Summarize these search results into a coherent overview. Group by theme, highlight key findings, and note any patterns or connections between items. Be concise but thorough.',
          `Search query: "${searchQuery || 'N/A'}"\n\nResults:\n${(searchResults || []).map((r: { source: string; title: string; snippet: string; occurred_at: string }, i: number) => `${i + 1}. [${r.source}] ${r.title}\n   ${r.snippet || 'No snippet'}\n   Date: ${r.occurred_at || 'unknown'}`).join('\n\n')}`
        );

        result = { summary: text };
        break;
      }

      // ============ CONTACTS AGENTS (additional) ============

      case 'dedupe_contacts': {
        // AI analyzes contacts for potential duplicates
        const { contacts: contactList } = context;
        const { text } = await callClaude(
          'Analyze this contact list for potential duplicates or entries that might refer to the same person (similar names, same email domain, etc). List any potential matches and suggest which to merge. If no duplicates found, say so clearly.',
          `Contact list:\n${(contactList || []).map((c: { name: string; email: string; organization: string }, i: number) => `${i + 1}. ${c.name} <${c.email || 'no email'}> - ${c.organization || 'no org'}`).join('\n')}`
        );

        result = { analysis: text };
        break;
      }

      // ============ SETTINGS AGENTS ============

      case 'usage_insights': {
        const { data: topics } = await supabase.from('topics').select('id, title, status, created_at')
          .eq('user_id', user.id);
        const { data: items } = await supabase.from('topic_items').select('id, source, created_at')
          .eq('user_id', user.id);
        const { data: aiRuns } = await supabase.from('ai_runs').select('kind, tokens_used, created_at')
          .eq('user_id', user.id);

        const totalTokens = (aiRuns || []).reduce((sum: number, r: { tokens_used: number | null }) => sum + (r.tokens_used || 0), 0);

        const { text } = await callClaude(
          'Generate insights about the user\'s platform usage. Include: trends, most active sources, AI usage stats, suggestions for improvement.',
          `Stats:\n- Topics: ${(topics || []).length} (active: ${(topics || []).filter((t: { status: string }) => t.status === 'active').length})\n- Items linked: ${(items || []).length}\n- AI runs: ${(aiRuns || []).length}\n- Total tokens: ${totalTokens}\n\nSources breakdown: ${JSON.stringify((items || []).reduce((acc: Record<string, number>, i: { source: string }) => { acc[i.source] = (acc[i.source] || 0) + 1; return acc; }, {}))}`
        );

        result = { insights: text, stats: { topics: (topics || []).length, items: (items || []).length, aiRuns: (aiRuns || []).length, totalTokens } };
        break;
      }

      case 'health_check': {
        // AI checks platform health and connectivity
        const [gRes, sRes, nRes, tRes, iRes] = await Promise.all([
          supabase.from('google_accounts').select('id, email').eq('user_id', user.id),
          supabase.from('slack_accounts').select('id, team_name').eq('user_id', user.id),
          supabase.from('notion_accounts').select('id, workspace_name').eq('user_id', user.id),
          supabase.from('topics').select('id').eq('user_id', user.id),
          supabase.from('topic_items').select('id, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        ]);

        const lastItem = iRes.data?.[0];
        const lastItemAge = lastItem ? Math.round((Date.now() - new Date(lastItem.created_at).getTime()) / (1000 * 60 * 60)) : null;

        const { text } = await callClaude(
          'Generate a platform health report. Check connectivity, data freshness, and suggest any improvements. Format with clear sections.',
          `Platform status:\n- Google accounts: ${(gRes.data || []).length} connected (${(gRes.data || []).map((a: {email: string}) => a.email).join(', ') || 'none'})\n- Slack workspaces: ${(sRes.data || []).length} connected\n- Notion workspaces: ${(nRes.data || []).length} connected\n- Total topics: ${(tRes.data || []).length}\n- Last item imported: ${lastItemAge !== null ? `${lastItemAge} hours ago` : 'never'}\n- All services reachable: Yes (API responding)`
        );

        result = { health: text };
        break;
      }

      case 'optimization_suggestions': {
        // AI suggests platform optimizations
        const { data: allTopics } = await supabase.from('topics').select('id, title, status, tags, folder_id, created_at, updated_at')
          .eq('user_id', user.id);
        const { data: allItems } = await supabase.from('topic_items').select('id, source, topic_id')
          .eq('user_id', user.id);
        const { data: allContacts } = await supabase.from('contacts').select('id, name, email')
          .eq('user_id', user.id);

        const activeTopics = (allTopics || []).filter(t => t.status === 'active');
        const topicsWithoutTags = activeTopics.filter(t => !t.tags || (t.tags as string[]).length === 0);
        const topicsWithoutFolder = activeTopics.filter(t => !t.folder_id);
        const orphanItems = (allItems || []).filter(i => !i.topic_id);

        const { text } = await callClaude(
          'Based on this platform usage data, suggest 5-7 specific, actionable optimizations the user should take to get more value from TopicOS. Focus on organization, productivity, and AI features.',
          `Usage data:\n- Topics: ${(allTopics || []).length} total, ${activeTopics.length} active\n- Topics without tags: ${topicsWithoutTags.length}\n- Topics without folders: ${topicsWithoutFolder.length}\n- Items: ${(allItems || []).length} total, ${orphanItems.length} orphaned (not linked to topics)\n- Contacts: ${(allContacts || []).length}\n- Sources used: ${[...new Set((allItems || []).map(i => i.source))].join(', ') || 'none'}\n\nAvailable features:\n- Folder hierarchy for topic organization\n- AI auto-tagging, description generation, action item extraction\n- Smart search with AI query enhancement\n- AI contact enrichment from communications\n- Weekly review and daily briefing agents`
        );

        result = { suggestions: text };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }

    // Log AI run
    await supabase.from('ai_runs').insert({
      user_id: user.id,
      topic_id: context?.topic_id || null,
      kind: `agent_${agent}`,
      model: 'claude-sonnet-4-5-20250929',
      input_summary: `Agent ${agent} run`,
      output_json: result,
    });

    return NextResponse.json({ result });
  } catch (err) {
    console.error('Agent error:', err);
    return NextResponse.json({ error: 'Agent failed: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 });
  }
}
