import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaude, callClaudeJSON } from '@/lib/ai/provider';
import { getTopicNoteContext } from '@/lib/ai/note-context';
import { enrichTopicItems } from '@/lib/search/content';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { agent, context } = body;
    if (!agent) return NextResponse.json({ error: 'Agent type required' }, { status: 400 });

    let result: Record<string, unknown> = {};
    let inputSummary = '';

    switch (agent) {
      // ============ TOPIC PAGE AGENTS ============

      case 'auto_tag': {
        // AI generates tags for a topic based on its content — deep analysis
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet, body, metadata').eq('topic_id', topic_id).limit(25);
        const noteContext = await getTopicNoteContext(topic_id);

        const { data } = await callClaudeJSON<{ tags: string[]; area: string; priority: number }>(
          `Analyze this topic's full content to generate accurate tags, area classification, and priority.

RULES for tags:
- Generate 3-8 specific, descriptive tags (not generic like "work" or "email")
- Tags should capture: the project/initiative name, key technologies, key organizations involved, the type of work (e.g., "grant-application", "hiring", "product-launch")
- Use lowercase-kebab-case for multi-word tags (e.g., "machine-learning", "budget-review")
- Look at email subjects, document titles, Slack channels, and body content for clues

RULES for area:
- "work" = professional/business activities
- "personal" = personal life, health, hobbies, family
- "career" = job search, learning, certifications, networking
- Look at the email domains, Slack workspace context, and content to decide

RULES for priority (1-5):
- 5 = critical/urgent (deadlines this week, blocking issues, executive escalations)
- 4 = high (active projects with near-term deadlines, important meetings)
- 3 = medium (ongoing projects, regular business)
- 2 = low (informational, nice-to-have, background items)
- 1 = minimal (archived, FYI only, no action needed)
- Consider: due dates, language urgency ("ASAP", "urgent"), stakeholder seniority, financial impact

Return JSON: { "tags": ["tag1", "tag2", ...], "area": "work|personal|career", "priority": 1-5 }`,
          `Topic: ${topic.title}\nDescription: ${topic.description || 'None'}\nCurrent tags: ${(topic.tags || []).join(', ') || 'None'}\n\nItems (${(items || []).length} total):\n${(items || []).map((i: { source: string; title: string; snippet: string; body?: string | null; metadata: Record<string, unknown> }) => {
            const content = i.body || i.snippet || '';
            const preview = content.length > 800 ? content.substring(0, 800) + '...' : content;
            const meta = i.metadata || {};
            let metaStr = '';
            if (meta.from) metaStr += ` | From: ${meta.from}`;
            if (meta.channel_name) metaStr += ` | #${meta.channel_name}`;
            return `[${i.source}] ${i.title}${metaStr}${preview ? '\n' + preview : ''}`;
          }).join('\n---\n')}\n${noteContext}`
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
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet, body').eq('topic_id', topic_id).limit(10);
        const noteContext = await getTopicNoteContext(topic_id);

        const { data } = await callClaudeJSON<{ suggestions: string[] }>(
          'Suggest 3 clear, concise titles for this topic based on its content from all sources. Return JSON: { "suggestions": ["Title 1", "Title 2", "Title 3"] }',
          `Current: ${topic.title}\nDescription: ${topic.description || 'None'}\nItems:\n${(items || []).map((i: { source: string; title: string; snippet: string; body?: string | null }) => {
            const content = i.body || i.snippet || '';
            const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
            return `[${i.source}] ${i.title}${preview ? ': ' + preview : ''}`;
          }).join('\n')}\n${noteContext}`
        );

        result = { suggestions: data.suggestions };
        break;
      }

      case 'generate_description': {
        // AI generates a rich description for a topic
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet, body').eq('topic_id', topic_id).limit(15);
        const noteContext = await getTopicNoteContext(topic_id);

        const { text } = await callClaude(
          'Write a concise but comprehensive description (2-4 sentences) for this topic/project that captures its essence, key participants, and objectives.',
          `Topic: ${topic.title}\nCurrent description: ${topic.description || 'None'}\nItems:\n${(items || []).map((i: { source: string; title: string; snippet: string; body?: string | null }) => {
            const content = i.body || i.snippet || '';
            const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
            return `[${i.source}] ${i.title}: ${preview}`;
          }).join('\n')}\n${noteContext}`
        );

        result = { description: text };
        break;
      }

      case 'extract_action_items': {
        // AI extracts action items from topic communications — deep extraction
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet, body, metadata, occurred_at').eq('topic_id', topic_id).order('occurred_at', { ascending: true }).limit(30);
        const noteContext = await getTopicNoteContext(topic_id);

        const { data } = await callClaudeJSON<{ action_items: Array<{ task: string; assignee: string; due: string; priority: string; source_item: string; status: string }> }>(
          `Extract ALL action items, tasks, commitments, promises, and follow-ups from these communications. Be thorough and look for:

1. EXPLICIT tasks: "Please do X", "Can you handle Y", "I need Z by Friday"
2. IMPLICIT commitments: "I'll look into it", "Let me check", "We should follow up"
3. DECISIONS that require action: "We agreed to move forward with X"
4. DEADLINES mentioned: dates, "next week", "by EOD", "Q4", "ASAP"
5. QUESTIONS awaiting answers: "Can you confirm?", "What do you think about?"
6. MEETING follow-ups: action items from calendar events, "as discussed..."
7. BLOCKED items: "waiting on X", "need approval for Y"

For each item, determine:
- assignee: the person responsible (use their actual name, not "unknown" unless truly ambiguous)
- due: specific date if mentioned, or "ASAP"/"This week"/"No deadline"
- priority: high (urgent/blocking), medium (important but not urgent), low (nice-to-have/informational)
- status: "pending" (not done yet), "in-progress" (partially done), "done" (completed in later messages), "blocked" (waiting on something)
- source_item: which email/message/event this came from (include date)

Return JSON: { "action_items": [{ "task": "description", "assignee": "person name", "due": "date or timeframe", "priority": "high|medium|low", "source_item": "brief source reference", "status": "pending|in-progress|done|blocked" }] }`,
          `Topic: ${topic.title}\nDescription: ${topic.description || 'None'}\nDue date: ${topic.due_date || 'Not set'}\n\nCommunications (chronological order):\n${(items || []).map((i: { source: string; title: string; snippet: string; body?: string | null; metadata: Record<string, unknown>; occurred_at: string }) => {
            const meta = i.metadata || {};
            const content = i.body || i.snippet || '';
            const contentPreview = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
            let header = `[${i.occurred_at}] [${i.source}] ${i.title}`;
            if (meta.from) header += `\nFrom: ${meta.from}`;
            if (meta.to) header += `\nTo: ${meta.to}`;
            if (meta.cc) header += `\nCC: ${meta.cc}`;
            if (meta.attendees) header += `\nAttendees: ${JSON.stringify(meta.attendees)}`;
            return `${header}\n${contentPreview}`;
          }).join('\n\n---\n\n')}\n${noteContext}`
        );

        result = { action_items: data.action_items };
        break;
      }

      case 'summarize_thread': {
        // AI summarizes all communications in a topic
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        const { data: items } = await supabase.from('topic_items').select('*').eq('topic_id', topic_id).order('occurred_at', { ascending: true }).limit(30);
        const noteContext = await getTopicNoteContext(topic_id);

        const { text } = await callClaude(
          'Create a chronological executive summary of this topic\'s communications and notes. Highlight key decisions, commitments, and open questions. Be concise but thorough.',
          `Topic: ${topic.title}\nDescription: ${topic.description || 'None'}\n\nCommunications (chronological):\n${(items || []).map((i: Record<string, unknown>) => {
            const meta = i.metadata as Record<string, unknown> || {};
            const content = (i.body as string) || (i.snippet as string) || '';
            const contentPreview = content.length > 1500 ? content.substring(0, 1500) + '...' : content;
            return `[${i.occurred_at}] [${i.source}] ${i.title}\n${contentPreview}\nFrom: ${meta.from || ''} To: ${meta.to || ''}`;
          }).join('\n---\n')}\n${noteContext}`
        );

        result = { summary: text };
        break;
      }

      // ============ DASHBOARD AGENTS ============

      case 'daily_briefing': {
        // AI generates a daily briefing
        const { data: topics } = await supabase.from('topics').select('id, title, description, due_date, status, priority, summary, tags')
          .eq('user_id', user.id).eq('status', 'active').order('priority', { ascending: false }).limit(10);
        const { data: recentItems } = await supabase.from('topic_items').select('title, source, snippet, body, occurred_at, topics(title)')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);

        const { text } = await callClaude(
          'You are an executive assistant. Generate a concise daily briefing for the user based on ALL their connected sources (email, calendar, drive, slack, notion, notes, links). Include: 1) Priority items needing attention today, 2) Key updates from recent activity, 3) Upcoming deadlines, 4) Suggested focus areas. Keep it brief and actionable.',
          `Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n\nActive Topics:\n${(topics || []).map((t: Record<string, unknown>) => `- ${t.title} (priority: ${t.priority || 0}, due: ${t.due_date || 'none'}, tags: ${(t.tags as string[] || []).join(', ')})\n  Summary: ${(t.summary as string || 'No summary').substring(0, 200)}`).join('\n')}\n\nRecent Items (from all sources):\n${(recentItems || []).map((i: Record<string, unknown>) => {
            const content = (i.body as string) || (i.snippet as string) || '';
            const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
            return `- [${i.source}] ${i.title} (${i.occurred_at}) → ${(i.topics as {title: string} | null)?.title || 'Unlinked'}${preview ? '\n  ' + preview : ''}`;
          }).join('\n')}`
        );

        result = { briefing: text };
        break;
      }

      case 'suggest_topics': {
        // AI suggests new topics based on uncategorized activity
        // Fetch MORE items for better pattern detection
        const { data: recentItems } = await supabase.from('topic_items').select('title, source, snippet, body')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
        // Get ALL topics (active + completed + archived) to avoid duplicating any
        const { data: allTopics } = await supabase.from('topics').select('title, description, status')
          .eq('user_id', user.id);

        // Client sends titles to exclude (previously suggested/dismissed)
        const excludeTitles: string[] = context.exclude_titles || [];
        const existingTopicTitles = (allTopics || []).map((t: { title: string }) => t.title);
        const allExcluded = [...existingTopicTitles, ...excludeTitles];

        const { data } = await callClaudeJSON<{ suggestions: Array<{ title: string; description: string; area: string; reason: string }> }>(
          `Based on recent activity patterns from ALL sources (email, calendar, drive, slack, notion, notes, links), suggest 5-8 new topics the user should create to organize their work.

CRITICAL RULES:
1. You MUST NOT suggest any topic that duplicates or is very similar to the EXCLUDED TOPICS list below. Check titles carefully — no synonyms, rephrasing, or close variants.
2. Each suggestion must be UNIQUE — do not repeat yourself within the same response.
3. Suggestions should be specific and actionable (e.g., "Q1 Budget Review" not "Finance").
4. Focus on patterns you see in the recent items that aren't covered by existing topics.
5. If an item is already linked to an existing topic, skip it.

Return JSON: { "suggestions": [{ "title": "...", "description": "...", "area": "work|personal|career", "reason": "Why this topic would help organize their work" }] }`,
          `=== EXCLUDED TOPICS (DO NOT SUGGEST THESE OR SIMILAR) ===
${allExcluded.map((t: string) => `• ${t}`).join('\n')}

=== RECENT UNORGANIZED ITEMS ===
${(recentItems || []).map((i: { source: string; title: string; snippet: string; body?: string | null }) => {
            const content = i.body || i.snippet || '';
            const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
            return `[${i.source}] ${i.title}${preview ? ': ' + preview : ''}`;
          }).join('\n')}`
        );

        // Server-side dedup: filter out any suggestions that match existing/excluded titles
        const lowerExcluded = new Set(allExcluded.map((t: string) => t.toLowerCase().trim()));
        const filtered = (data.suggestions || []).filter(s => {
          const lower = s.title.toLowerCase().trim();
          // Exact match check
          if (lowerExcluded.has(lower)) return false;
          // Fuzzy check: if suggestion contains an existing topic name or vice versa
          for (const existing of lowerExcluded) {
            if (lower.includes(existing) || existing.includes(lower)) return false;
            // Check if >60% of words overlap
            const sWords = new Set(lower.split(/\s+/));
            const eWords = new Set(existing.split(/\s+/));
            const overlap = [...sWords].filter(w => eWords.has(w) && w.length > 2).length;
            if (overlap > 0 && overlap / Math.min(sWords.size, eWords.size) > 0.6) return false;
          }
          return true;
        });

        result = { suggestions: filtered };
        break;
      }

      case 'weekly_review': {
        // AI generates a weekly review
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentItems } = await supabase.from('topic_items').select('title, source, snippet, body, occurred_at, topics(title)')
          .eq('user_id', user.id).gte('created_at', oneWeekAgo).order('created_at', { ascending: false }).limit(50);
        const { data: topics } = await supabase.from('topics').select('title, status, updated_at, summary')
          .eq('user_id', user.id).gte('updated_at', oneWeekAgo);
        const { data: aiRuns } = await supabase.from('ai_runs').select('kind, input_summary, created_at')
          .eq('user_id', user.id).gte('created_at', oneWeekAgo);

        const { text } = await callClaude(
          'Generate a weekly review summary. Include: 1) Key accomplishments, 2) Topics that progressed, 3) Items that need follow-up, 4) Productivity stats, 5) Priorities for next week.',
          `Week of ${new Date(oneWeekAgo).toLocaleDateString()} - ${new Date().toLocaleDateString()}\n\nItems processed: ${(recentItems || []).length}\nTopics updated: ${(topics || []).length}\nAI runs: ${(aiRuns || []).length}\n\nRecent items (from ALL sources — email, calendar, drive, slack, notion, notes, links):\n${(recentItems || []).map((i: Record<string, unknown>) => {
            const content = (i.body as string) || (i.snippet as string) || '';
            const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
            return `[${i.source}] ${i.title} → ${(i.topics as {title: string} | null)?.title || 'Unlinked'}${preview ? '\n  ' + preview : ''}`;
          }).join('\n')}\n\nUpdated topics:\n${(topics || []).map((t: Record<string, unknown>) => `- ${t.title} (${t.status})`).join('\n')}`
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
        // AI enriches a contact profile — deep identity resolution
        const { contact_id } = context;
        const { data: contact } = await supabase.from('contacts').select('*').eq('id', contact_id).eq('user_id', user.id).single();
        if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        const { data: interactions } = await supabase.from('topic_items').select('title, source, snippet, body, occurred_at, metadata')
          .eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(100);

        // Find items mentioning this contact — broader matching
        const contactEmail = (contact.email || '').toLowerCase();
        const contactName = (contact.name || '').toLowerCase();
        const contactNameParts = contactName.split(/\s+/).filter((p: string) => p.length > 2);

        const contactItems = (interactions || []).filter((i: Record<string, unknown>) => {
          const meta = i.metadata as Record<string, string> || {};
          const metaStr = JSON.stringify(meta).toLowerCase();
          const fullText = `${(i.title as string || '')} ${(i.snippet as string || '')} ${(i.body as string || '')}`.toLowerCase();

          // Match by email
          if (contactEmail && contactEmail.length > 3) {
            if (metaStr.includes(contactEmail) || fullText.includes(contactEmail)) return true;
          }
          // Match by full name
          if (contactName.length > 3) {
            if (metaStr.includes(contactName) || fullText.includes(contactName)) return true;
          }
          // Match by name parts (first or last name in metadata)
          for (const part of contactNameParts) {
            if (part.length > 3 && metaStr.includes(part)) return true;
          }
          return false;
        });

        const { data } = await callClaudeJSON<{ organization: string; role: string; relationship_summary: string; interaction_frequency: string; key_topics: string[]; communication_style: string; last_discussed: string }>(
          `You are building a comprehensive profile for a contact based on ALL their communications. Analyze deeply:

1. ORGANIZATION: Look at their email domain, email signature, how they introduce themselves, company mentions in body text
2. ROLE/TITLE: Look for email signatures (usually at the bottom of emails, after "Best regards" or similar), LinkedIn-style titles, how others address them ("Dear Director...", "Hi Professor...")
3. RELATIONSHIP: How does the user interact with this person? Are they a colleague, client, vendor, manager, friend? Look at the tone, formality level, and topics discussed.
4. COMMUNICATION STYLE: Formal/informal, response speed, who typically initiates
5. KEY TOPICS: What specific projects, topics, or subjects do they discuss together?
6. LAST DISCUSSED: What was the most recent conversation about?

IMPORTANT: Read the FULL body content of emails and messages, especially email signatures which contain role, organization, and phone numbers.

Return JSON: {
  "organization": "Company/Org name or empty string",
  "role": "Their job title/role or estimated role",
  "relationship_summary": "2-3 sentence summary of the relationship",
  "interaction_frequency": "daily|weekly|monthly|rare",
  "key_topics": ["topic1", "topic2"],
  "communication_style": "brief description of how they communicate",
  "last_discussed": "what the most recent interaction was about"
}`,
          `Contact: ${contact.name} <${contact.email || 'no email'}>
Current organization: ${contact.organization || 'unknown'}
Current role: ${contact.role || 'unknown'}
Current notes: ${contact.notes || 'none'}

Relevant communications (${contactItems.length} items found across all sources):
${contactItems.slice(0, 25).map((i: Record<string, unknown>, idx: number) => {
  const meta = i.metadata as Record<string, unknown> || {};
  const content = (i.body as string) || (i.snippet as string) || '';
  const preview = content.length > 1200 ? content.substring(0, 1200) + '...' : content;
  let header = `${idx + 1}. [${i.occurred_at}] [${i.source}] ${i.title}`;
  if (meta.from) header += `\n   From: ${meta.from}`;
  if (meta.to) header += `\n   To: ${meta.to}`;
  if (meta.cc) header += `\n   CC: ${meta.cc}`;
  if (meta.channel_name) header += `\n   Channel: #${meta.channel_name}`;
  if (meta.username) header += `\n   Slack user: ${meta.username}`;
  return `${header}\n   Content: ${preview}`;
}).join('\n\n')}`
        );

        await supabase.from('contacts').update({
          organization: data.organization || contact.organization,
          role: data.role || contact.role,
          notes: data.relationship_summary,
        }).eq('id', contact_id);

        result = data;
        break;
      }

      case 'find_contacts': {
        // AI extracts contacts from topic items — DEEP identity resolution
        const { topic_id } = context;
        const { data: items } = await supabase.from('topic_items').select('title, source, snippet, body, metadata')
          .eq('topic_id', topic_id).limit(30);
        const noteContext = await getTopicNoteContext(topic_id);

        // Also get existing contacts for dedup
        const { data: existingContacts } = await supabase.from('contacts').select('name, email').eq('user_id', user.id);

        const { data } = await callClaudeJSON<{ contacts: Array<{ name: string; email: string; role: string; organization: string; relevance: string; source_evidence: string }> }>(
          `You are an expert at extracting and identifying people from communications. Analyze ALL items deeply to find every person involved in this topic.

CRITICAL RULES:
1. DISTINGUISH between the user (who owns these communications) and other people. The user typically appears in "From:" for sent emails and "To:" for received ones. Do NOT extract the user as a contact.
2. For each person, look across ALL items to build a complete picture. The same person may appear as an email sender, a calendar attendee, and a Slack username — merge them.
3. Extract emails from: "From:" / "To:" / "CC:" headers, email signatures, calendar attendee lists, and body text mentions.
4. Infer roles from: email signatures (look for title lines after the name), how they're addressed, what they discuss, their email domain.
5. Infer organization from: email domain (e.g., @company.com → Company), email signatures, or explicit mentions.
6. Rate relevance: "key" (major participant, decision-maker), "involved" (regular contributor), "mentioned" (referenced but not active), "peripheral" (CC'd or briefly mentioned).
7. If the same person appears with slightly different names (e.g., "John" vs "John Smith" vs "J. Smith"), merge them using the most complete version.
8. Look for people mentioned BY NAME in email/message bodies even if they aren't in the From/To headers.

ALREADY KNOWN CONTACTS (avoid duplicates):
${(existingContacts || []).map((c: { name: string; email: string }) => `- ${c.name} <${c.email || 'no email'}>`).join('\n') || 'None'}

Return JSON: { "contacts": [{ "name": "Full Name", "email": "email@example.com or empty string", "role": "their role/title", "organization": "their company/org", "relevance": "key|involved|mentioned|peripheral", "source_evidence": "brief explanation of where you found this person" }] }`,
          `Items:\n${(items || []).map((i: Record<string, unknown>) => {
            const meta = i.metadata as Record<string, unknown> || {};
            const content = (i.body as string) || (i.snippet as string) || '';
            const contentPreview = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
            let metaStr = '';
            if (meta.from) metaStr += `\nFrom: ${meta.from}`;
            if (meta.to) metaStr += `\nTo: ${meta.to}`;
            if (meta.cc) metaStr += `\nCC: ${meta.cc}`;
            if (meta.bcc) metaStr += `\nBCC: ${meta.bcc}`;
            if (meta.attendees) {
              const attendees = meta.attendees as Array<Record<string, unknown>>;
              if (Array.isArray(attendees)) {
                metaStr += `\nAttendees: ${attendees.map(a => typeof a === 'string' ? a : `${a.email || ''} (${a.displayName || a.name || ''}, ${a.responseStatus || ''})`).join('; ')}`;
              }
            }
            if (meta.username) metaStr += `\nSlack user: ${meta.username}`;
            if (meta.channel_name) metaStr += `\nChannel: #${meta.channel_name}`;
            return `[${i.source}] ${i.title}${metaStr}\nContent:\n${contentPreview}`;
          }).join('\n\n---\n\n')}\n${noteContext}`
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

      case 'propose_next_email': {
        // AI suggests the next email to send to a contact
        const { contact_id: proposeContactId } = context;
        const { data: proposeContact } = await supabase.from('contacts').select('*').eq('id', proposeContactId).eq('user_id', user.id).single();
        if (!proposeContact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        // Get linked topics
        const { data: contactLinks } = await supabase
          .from('contact_topic_links')
          .select('topic_id, role, topics(title, status, due_date, priority)')
          .eq('contact_id', proposeContactId);

        // Get items mentioning this contact (include body for full content from all sources)
        const { data: proposeItems } = await supabase.from('topic_items')
          .select('title, source, snippet, body, occurred_at, metadata')
          .eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(100);

        const contactEmail = (proposeContact.email || '').toLowerCase();
        const contactName = (proposeContact.name || '').toLowerCase();
        const relevantItems = (proposeItems || []).filter((i: Record<string, unknown>) => {
          const metaStr = JSON.stringify(i.metadata || {}).toLowerCase();
          const fullText = `${(i.title as string || '')} ${(i.snippet as string || '')} ${(i.body as string || '')}`.toLowerCase();
          return (contactEmail && (metaStr.includes(contactEmail) || fullText.includes(contactEmail))) ||
                 (contactName.length > 2 && (metaStr.includes(contactName) || fullText.includes(contactName)));
        }).slice(0, 30);

        const pendingTopics = (contactLinks || []).filter((l: Record<string, unknown>) => {
          const topic = l.topics as Record<string, unknown> | null;
          return topic?.status === 'active';
        });

        const { data: emailData } = await callClaudeJSON<{
          should_email: boolean;
          urgency: string;
          reason: string;
          suggested_subject: string;
          key_points: string[];
          tone: string;
          draft_body: string;
        }>(
          `Analyze the communication history with this contact and determine if/what email should be sent next. Consider:
- How long since last interaction
- Any pending commitments or action items
- Open topics that need follow-up
- Relationship maintenance needs

Return JSON: { "should_email": true/false, "urgency": "high|medium|low", "reason": "why this email is needed", "suggested_subject": "email subject line", "key_points": ["point1", "point2"], "tone": "professional|friendly|urgent|follow-up", "draft_body": "full draft email body text" }`,
          `Contact: ${proposeContact.name} <${proposeContact.email || 'no email'}>
Organization: ${proposeContact.organization || 'unknown'}
Role: ${proposeContact.role || 'unknown'}
Last interaction: ${proposeContact.last_interaction_at || 'unknown'}
Interaction count: ${proposeContact.interaction_count || 0}

Pending/Active Topics (${pendingTopics.length}):
${pendingTopics.map((l: Record<string, unknown>) => {
  const t = l.topics as Record<string, unknown> | null;
  return `- ${t?.title || 'Unknown'} (priority: ${t?.priority || 'none'}, due: ${t?.due_date || 'none'})`;
}).join('\n')}

Recent Communications (${relevantItems.length} items from ALL sources including emails, calendar, drive, slack, notion, notes, links):
${relevantItems.map((i: Record<string, unknown>, idx: number) => {
  const meta = i.metadata as Record<string, unknown> || {};
  const content = (i.body as string) || (i.snippet as string) || '';
  const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
  return `${idx + 1}. [${i.source}] ${i.title}\n   From: ${meta.from || ''}\n   Date: ${i.occurred_at}\n   Content: ${preview}`;
}).join('\n')}`
        );

        // Store suggestion in contact metadata
        await supabase.from('contacts').update({
          metadata: {
            ...(proposeContact.metadata || {}),
            last_email_suggestion: { ...emailData, generated_at: new Date().toISOString() },
          },
        }).eq('id', proposeContactId);

        result = emailData;
        inputSummary = `Proposed next email for "${proposeContact.name}"`;
        break;
      }

      case 'contact_intelligence': {
        // AI generates comprehensive contact intelligence report
        const { contact_id: intelContactId } = context;
        const { data: intelContact } = await supabase.from('contacts').select('*').eq('id', intelContactId).eq('user_id', user.id).single();
        if (!intelContact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        // Get linked topics with details
        const { data: intelLinks } = await supabase
          .from('contact_topic_links')
          .select('topic_id, role, topics(title, status, area, due_date)')
          .eq('contact_id', intelContactId);

        // Get all items mentioning this contact (include body for full content from all sources)
        const { data: intelItems } = await supabase.from('topic_items')
          .select('title, source, snippet, body, occurred_at, metadata')
          .eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(200);

        const intelEmail = (intelContact.email || '').toLowerCase();
        const intelName = (intelContact.name || '').toLowerCase();
        const intelRelevant = (intelItems || []).filter((i: Record<string, unknown>) => {
          const metaStr = JSON.stringify(i.metadata || {}).toLowerCase();
          const fullText = `${(i.title as string || '')} ${(i.snippet as string || '')} ${(i.body as string || '')}`.toLowerCase();
          return (intelEmail && (metaStr.includes(intelEmail) || fullText.includes(intelEmail))) ||
                 (intelName.length > 2 && (metaStr.includes(intelName) || fullText.includes(intelName)));
        }).slice(0, 40);

        const { data: intelData } = await callClaudeJSON<{
          relationship_health: number;
          communication_pattern: string;
          sentiment: string;
          key_discussion_themes: string[];
          shared_interests: string[];
          best_contact_times: string;
          relationship_trajectory: string;
          action_recommendations: string[];
          summary: string;
        }>(
          `Analyze this contact's communication history and generate a comprehensive intelligence report. Return JSON:
{
  "relationship_health": 0-100 (100=strong, 0=nonexistent),
  "communication_pattern": "description of how often and how they communicate (e.g. Regular bi-weekly, Sporadic, Project-based)",
  "sentiment": "Very Positive|Positive|Neutral|Needs Attention|Negative",
  "key_discussion_themes": ["theme1", "theme2"],
  "shared_interests": ["interest1", "interest2"],
  "best_contact_times": "description of optimal contact timing",
  "relationship_trajectory": "Growing|Stable|Declining|New",
  "action_recommendations": ["specific action 1", "specific action 2"],
  "summary": "2-3 sentence executive summary of the relationship"
}`,
          `Contact: ${intelContact.name} <${intelContact.email || 'no email'}>
Organization: ${intelContact.organization || 'unknown'}
Role: ${intelContact.role || 'unknown'}
Last interaction: ${intelContact.last_interaction_at || 'unknown'}
Total interactions: ${intelContact.interaction_count || 0}
Current notes: ${intelContact.notes || 'none'}

Linked Topics (${(intelLinks || []).length}):
${(intelLinks || []).map((l: Record<string, unknown>) => {
  const t = l.topics as Record<string, unknown> | null;
  return `- ${t?.title || 'Unknown'} (${t?.status || 'unknown'}, ${l.role || 'no role'})`;
}).join('\n')}

Communication History (${intelRelevant.length} items from ALL sources — emails, calendar, drive, slack, notion, notes, links):
${intelRelevant.map((i: Record<string, unknown>, idx: number) => {
  const meta = i.metadata as Record<string, unknown> || {};
  const content = (i.body as string) || (i.snippet as string) || '';
  const preview = content.length > 600 ? content.substring(0, 600) + '...' : content;
  return `${idx + 1}. [${i.source}] ${i.title} — ${i.occurred_at}\n   From: ${meta.from || ''} To: ${meta.to || ''}\n   Content: ${preview}`;
}).join('\n')}`
        );

        // Store intelligence in contact metadata
        await supabase.from('contacts').update({
          metadata: {
            ...(intelContact.metadata || {}),
            intelligence: { ...intelData, updated_at: new Date().toISOString() },
          },
        }).eq('id', intelContactId);

        result = intelData;
        inputSummary = `Intelligence report for "${intelContact.name}"`;
        break;
      }

      case 'contact_auto_link': {
        // Auto-link contacts to topics based on topic_items metadata matching — improved matching
        const allContacts = await supabase.from('contacts').select('id, name, email').eq('user_id', user.id);
        const allItems = await supabase.from('topic_items').select('topic_id, title, snippet, body, metadata').eq('user_id', user.id);
        const existingLinks = await supabase.from('contact_topic_links').select('contact_id, topic_id').eq('user_id', user.id);

        const existingSet = new Set((existingLinks.data || []).map((l: Record<string, unknown>) => `${l.contact_id}:${l.topic_id}`));
        const newLinks: Array<{ user_id: string; contact_id: string; topic_id: string }> = [];

        for (const contact of (allContacts.data || [])) {
          const cEmail = (contact.email || '').toLowerCase();
          const cName = (contact.name || '').toLowerCase();
          // Split name into parts for partial matching (first name, last name)
          const nameParts = cName.split(/\s+/).filter((p: string) => p.length > 2);
          if (!cEmail && nameParts.length === 0) continue;

          const topicIds = new Set<string>();
          for (const item of (allItems.data || [])) {
            const metaStr = JSON.stringify(item.metadata || {}).toLowerCase();
            const fullText = `${(item.title || '')} ${(item.snippet || '')} ${(item.body || '')}`.toLowerCase();

            let matched = false;

            // Match by email (strongest signal)
            if (cEmail && cEmail.length > 3) {
              if (metaStr.includes(cEmail) || fullText.includes(cEmail)) matched = true;
            }

            // Match by full name
            if (!matched && cName.length > 4) {
              if (metaStr.includes(cName) || fullText.includes(cName)) matched = true;
            }

            // Match by email username part in metadata (e.g., "jorge.rodelgo" from "jorge.rodelgo@company.com")
            if (!matched && cEmail) {
              const emailUsername = cEmail.split('@')[0];
              if (emailUsername.length > 4 && metaStr.includes(emailUsername)) matched = true;
            }

            // Match by first+last name parts in metadata (for "From: John Smith <js@co.com>")
            if (!matched && nameParts.length >= 2) {
              // Both first AND last name must appear in metadata to avoid false positives
              const allInMeta = nameParts.every((part: string) => metaStr.includes(part));
              if (allInMeta) matched = true;
            }

            if (matched) {
              topicIds.add(item.topic_id);
            }
          }

          for (const topicId of topicIds) {
            const key = `${contact.id}:${topicId}`;
            if (!existingSet.has(key)) {
              newLinks.push({ user_id: user.id, contact_id: contact.id, topic_id: topicId });
              existingSet.add(key);
            }
          }
        }

        if (newLinks.length > 0) {
          // Insert in batches
          for (let i = 0; i < newLinks.length; i += 50) {
            const { error: batchError } = await supabase.from('contact_topic_links').upsert(
              newLinks.slice(i, i + 50),
              { onConflict: 'contact_id, topic_id' }
            );
            if (batchError) console.error('Auto-link batch error:', batchError.message);
          }
        }

        result = { links_created: newLinks.length, contacts_processed: (allContacts.data || []).length };
        inputSummary = `Auto-linked contacts: ${newLinks.length} new links created`;
        break;
      }

      case 'contact_action_items': {
        // Extract action items across all topics linked to a contact
        const { contact_id: actionContactId } = context;
        const { data: actionContact } = await supabase.from('contacts').select('*').eq('id', actionContactId).eq('user_id', user.id).single();
        if (!actionContact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        const { data: actionLinks } = await supabase
          .from('contact_topic_links')
          .select('topic_id, topics(title)')
          .eq('contact_id', actionContactId);

        const topicIds = (actionLinks || []).map((l: Record<string, unknown>) => l.topic_id as string);
        if (topicIds.length === 0) {
          result = { action_items: [], message: 'No topics linked to this contact' };
          break;
        }

        const { data: actionItems } = await supabase.from('topic_items')
          .select('title, source, snippet, body, occurred_at, topic_id, metadata')
          .in('topic_id', topicIds)
          .order('occurred_at', { ascending: false })
          .limit(50);

        const topicTitles: Record<string, string> = {};
        for (const link of (actionLinks || [])) {
          const t = (link as Record<string, unknown>).topics as Record<string, unknown> | null;
          topicTitles[link.topic_id as string] = (t?.title as string) || 'Unknown';
        }

        const { data: actionData } = await callClaudeJSON<{
          action_items: Array<{
            task: string;
            topic: string;
            priority: string;
            due_hint: string;
            status: string;
          }>;
        }>(
          `Extract all action items, commitments, and follow-ups related to this person from the communications. Return JSON:
{ "action_items": [{ "task": "description", "topic": "topic name", "priority": "high|medium|low", "due_hint": "any mentioned deadline or ASAP", "status": "pending|done|unclear" }] }`,
          `Contact: ${actionContact.name} <${actionContact.email || ''}>

Items from their linked topics (ALL sources — emails, calendar, drive, slack, notion, notes, links):
${(actionItems || []).map((i: Record<string, unknown>, idx: number) => {
  const content = (i.body as string) || (i.snippet as string) || '';
  const preview = content.length > 800 ? content.substring(0, 800) + '...' : content;
  return `${idx + 1}. [${i.source}] ${i.title} (Topic: ${topicTitles[i.topic_id as string] || 'Unknown'})\n   ${preview}`;
}).join('\n')}`
        );

        result = actionData;
        inputSummary = `Action items for "${actionContact.name}": ${actionData.action_items.length} found`;
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
          'Based on this platform usage data, suggest 5-7 specific, actionable optimizations the user should take to get more value from YouOS. Focus on organization, productivity, and AI features.',
          `Usage data:\n- Topics: ${(allTopics || []).length} total, ${activeTopics.length} active\n- Topics without tags: ${topicsWithoutTags.length}\n- Topics without folders: ${topicsWithoutFolder.length}\n- Items: ${(allItems || []).length} total, ${orphanItems.length} orphaned (not linked to topics)\n- Contacts: ${(allContacts || []).length}\n- Sources used: ${[...new Set((allItems || []).map(i => i.source))].join(', ') || 'none'}\n\nAvailable features:\n- Folder hierarchy for topic organization\n- AI auto-tagging, description generation, action item extraction\n- Smart search with AI query enhancement\n- AI contact enrichment from communications\n- Weekly review and daily briefing agents`
        );

        result = { suggestions: text };
        break;
      }

      // ============ DEEP CONTENT AGENTS ============

      case 'deep_dive': {
        // AI Deep Dive — fetches full content from ALL linked items and generates comprehensive report
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        const noteContext = await getTopicNoteContext(topic_id);

        // Enrich all items (fetch full content from sources)
        const { enriched, failed, items: enrichedItems } = await enrichTopicItems(user.id, topic_id);

        // Get full items with metadata for the prompt
        const { data: fullItems } = await supabase.from('topic_items')
          .select('title, source, snippet, body, metadata, occurred_at')
          .eq('topic_id', topic_id)
          .order('occurred_at', { ascending: true })
          .limit(30);

        // Build rich content prompt using body when available
        const itemsContent = (fullItems || []).map((item: Record<string, unknown>, i: number) => {
          const meta = item.metadata as Record<string, unknown> || {};
          const body = (item.body as string) || (item.snippet as string) || '';
          const contentPreview = body.length > 2000 ? body.substring(0, 2000) + '...' : body;
          let details = `\n--- Item ${i + 1} [${item.source}] ---\nTitle: ${item.title}\nDate: ${item.occurred_at}`;
          if (meta.from) details += `\nFrom: ${meta.from}`;
          if (meta.to) details += `\nTo: ${meta.to}`;
          if (meta.attendees) details += `\nAttendees: ${(meta.attendees as string[]).join(', ')}`;
          if (meta.channel_name) details += `\nChannel: #${meta.channel_name}`;
          details += `\nContent:\n${contentPreview}`;
          return details;
        }).join('\n');

        const { text } = await callClaude(
          `You are performing a DEEP DIVE analysis of a topic/project. You have access to FULL CONTENT of linked items (emails, documents, messages, events, attachments), not just snippets.

CRITICAL INSTRUCTIONS:
- READ every email body completely — they contain decisions, commitments, questions, and context
- READ email signatures to identify roles, organizations, and contact details
- READ Slack context: thread conversations AND surrounding channel messages provide crucial context
- READ attachment content when included (marked as "📎 filename")
- CROSS-REFERENCE across sources: an email may reference a Slack discussion, a calendar event may follow up on an email
- IDENTIFY who sent vs received each item to understand the user's role
- TRACK conversation threads: understand the back-and-forth, not just individual messages

Provide an extremely comprehensive analysis:

## Executive Summary
3-5 sentences capturing the full picture of this topic — what it's about, who's involved, current status, and what needs attention most.

## Detailed Timeline
Chronological breakdown of ALL events, decisions, and communications with specific dates and participants. Include:
- Emails sent/received with key points
- Meetings held and their outcomes
- Slack discussions and their conclusions
- Documents shared and their significance
- Deadlines passed or upcoming

## Key Decisions Made
List every decision identified from the full content:
- What was decided
- Who made the decision (and their authority)
- When it was made
- What triggered the decision
- Any dissent or conditions

## Action Items & Commitments
Every task, commitment, or promise found, with:
- Specific description
- Who is responsible
- Deadline (explicit or implied)
- Current status (done/pending/overdue/blocked)
- Source reference (which email/message)

## People & Roles
Detailed profile of each person involved:
- Full name and title (from email signatures or mentions)
- Organization (from email domain or explicit)
- Role in this topic (decision-maker, executor, advisor, stakeholder)
- Communication frequency and last interaction
- Key contributions or positions

## Risks & Blockers
- Unresolved questions or ambiguities
- Waiting items (waiting on responses, approvals, deliverables)
- Potential conflicts between stakeholders
- Scope or timeline risks
- Missing information or dependencies

## Content Gaps
- What information is missing from the linked items?
- Which sources haven't been checked (e.g., no Drive files, no Slack messages)?
- What follow-up questions should be asked?
- Any referenced documents or conversations not yet linked?

## Strategic Recommendations
3-5 strategic recommendations based on the comprehensive analysis. For each:
- What to do
- Why it matters
- Suggested timeline
- Who should take the lead

Be EXTREMELY specific. Reference actual content, dates, people, and quotes. This is a deep analysis, not a surface summary.`,
          `Topic: ${topic.title}
Description: ${topic.description || 'None'}
Area: ${topic.area}
Status: ${topic.status}
Tags: ${(topic.tags || []).join(', ') || 'None'}
Due date: ${topic.due_date || 'Not set'}
${noteContext}

Content enrichment: ${enriched} items enriched, ${failed} failed

Full Content of ${(fullItems || []).length} Linked Items:
${itemsContent}`,
          { maxTokens: 8192 }
        );

        // Store deep dive report
        await supabase.from('topics').update({
          summary: text,
          updated_at: new Date().toISOString(),
        }).eq('id', topic_id);

        result = { report: text, enriched_count: enriched, failed_count: failed };
        break;
      }

      case 'recommend_content': {
        // AI Content Recommender — analyzes linked items and suggests searches to find MORE related content
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { data: items } = await supabase.from('topic_items')
          .select('title, source, snippet, body, metadata')
          .eq('topic_id', topic_id).limit(20);
        const noteContext = await getTopicNoteContext(topic_id);

        const itemsSummary = (items || []).map((i: Record<string, unknown>) => {
          const meta = i.metadata as Record<string, unknown> || {};
          return `[${i.source}] ${i.title} — ${((i.body as string) || (i.snippet as string) || '').substring(0, 300)}${meta.from ? ` (from: ${meta.from})` : ''}`;
        }).join('\n');

        const { data } = await callClaudeJSON<{
          recommendations: Array<{
            source: string;
            query: string;
            reason: string;
            expected_type: string;
          }>;
          missing_sources: string[];
          suggested_people: string[];
        }>(
          `You are a content discovery assistant. Analyze the linked items and suggest SPECIFIC search queries to find MORE related content the user might have missed.

For each recommendation, provide:
- source: which source to search (gmail, calendar, drive, slack, notion)
- query: the exact search query to use (use source-specific syntax)
- reason: why this content might be relevant
- expected_type: what kind of content you expect to find

Also identify:
- missing_sources: which sources are underrepresented (e.g., "No Drive files linked — there might be relevant documents")
- suggested_people: people mentioned in items who might have more related communications

Return JSON: { "recommendations": [...], "missing_sources": [...], "suggested_people": [...] }`,
          `Topic: ${topic.title}
Description: ${topic.description || 'None'}
Tags: ${(topic.tags || []).join(', ') || 'None'}
${noteContext}

Currently linked items (${(items || []).length}):
${itemsSummary}`
        );

        result = { recommendations: data.recommendations, missing_sources: data.missing_sources, suggested_people: data.suggested_people };
        break;
      }

      case 'extract_entities': {
        // Entity Extraction — extracts people, companies, dates, amounts, and action items from full content
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        // Enrich items to get full content
        await enrichTopicItems(user.id, topic_id);

        const { data: items } = await supabase.from('topic_items')
          .select('title, source, snippet, body, metadata')
          .eq('topic_id', topic_id).limit(20);
        const noteContext = await getTopicNoteContext(topic_id);

        const itemsContent = (items || []).map((i: Record<string, unknown>) => {
          const body = (i.body as string) || (i.snippet as string) || '';
          return `[${i.source}] ${i.title}:\n${body.substring(0, 1500)}`;
        }).join('\n---\n');

        const { data } = await callClaudeJSON<{
          people: Array<{ name: string; email: string; role: string; mention_count: number }>;
          organizations: Array<{ name: string; type: string; context: string }>;
          dates: Array<{ date: string; description: string; type: string }>;
          amounts: Array<{ value: string; currency: string; context: string }>;
          action_items: Array<{ task: string; assignee: string; due: string; status: string }>;
        }>(
          `Extract all entities from the full content of these items. Be thorough and extract:

1. People: name, email (if found), apparent role, and how many times they're mentioned
2. Organizations: company/org name, type (client/vendor/partner/internal), context of mention
3. Key Dates: date/deadline, what it relates to, type (deadline/meeting/milestone)
4. Monetary Amounts: value, currency, what it relates to
5. Action Items: task description, who's responsible, due date if mentioned, current status (pending/done/blocked)

Return JSON: { "people": [...], "organizations": [...], "dates": [...], "amounts": [...], "action_items": [...] }`,
          `Topic: ${topic.title}\n${noteContext}\n\nFull Content:\n${itemsContent}`
        );

        result = data;
        break;
      }

      case 'cross_topic_links': {
        // Cross-Topic Linking — finds related topics based on content analysis
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { data: items } = await supabase.from('topic_items')
          .select('title, source, snippet, body, metadata')
          .eq('topic_id', topic_id).limit(15);

        // Get all other topics for comparison
        const { data: allTopics } = await supabase.from('topics')
          .select('id, title, description, tags, summary')
          .eq('user_id', user.id)
          .neq('id', topic_id)
          .eq('status', 'active');

        if (!allTopics || allTopics.length === 0) {
          result = { related_topics: [], message: 'No other active topics to compare against.' };
          break;
        }

        const currentItems = (items || []).map((i: Record<string, unknown>) => {
          const content = (i.body as string) || (i.snippet as string) || '';
          return `[${i.source}] ${i.title}: ${content.substring(0, 400)}`;
        }).join('\n');
        const otherTopics = allTopics.map((t: Record<string, unknown>) =>
          `ID: ${t.id}\nTitle: ${t.title}\nDescription: ${t.description || 'None'}\nTags: ${(t.tags as string[] || []).join(', ')}\nSummary: ${((t.summary as string) || '').substring(0, 300)}`
        ).join('\n---\n');

        const { data } = await callClaudeJSON<{
          related_topics: Array<{ topic_id: string; title: string; reason: string; confidence: number; relationship: string }>;
        }>(
          `Analyze the current topic and find related topics from the user's collection. For each related topic, explain:
- How they're connected
- The type of relationship (parent, child, related, dependent, conflicting)
- Confidence score (0-1)

Return JSON: { "related_topics": [{ "topic_id": "uuid", "title": "topic name", "reason": "explanation of connection", "confidence": 0.0-1.0, "relationship": "related|parent|child|dependent|conflicting" }] }
Only include topics with confidence >= 0.3.`,
          `Current Topic: ${topic.title}
Description: ${topic.description || 'None'}
Tags: ${(topic.tags || []).join(', ') || 'None'}
Items:\n${currentItems}

Other Topics:\n${otherTopics}`
        );

        result = { related_topics: data.related_topics };
        break;
      }

      case 'completeness_check': {
        // Topic Completeness Score — evaluates topic for missing information and gaps
        const { topic_id } = context;
        const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const { data: items } = await supabase.from('topic_items')
          .select('source, occurred_at, metadata, body')
          .eq('topic_id', topic_id);

        const { data: contacts } = await supabase.from('contact_topic_links')
          .select('contact_id')
          .eq('topic_id', topic_id);

        const noteContext = await getTopicNoteContext(topic_id);
        const itemCount = (items || []).length;
        const sources = [...new Set((items || []).map((i: { source: string }) => i.source))];
        const allSources = ['gmail', 'calendar', 'drive', 'slack', 'notion'];
        const missingSources = allSources.filter(s => !sources.includes(s));
        const contactCount = (contacts || []).length;

        // Check temporal coverage
        const dates = (items || []).map((i: { occurred_at: string }) => new Date(i.occurred_at).getTime()).sort();
        const oldestItem = dates.length > 0 ? new Date(dates[0]) : null;
        const newestItem = dates.length > 0 ? new Date(dates[dates.length - 1]) : null;
        const daysSinceLastItem = newestItem ? Math.round((Date.now() - newestItem.getTime()) / (1000 * 60 * 60 * 24)) : null;

        // Calculate base score
        let score = 0;
        if (topic.description) score += 10;
        if (topic.tags && (topic.tags as string[]).length > 0) score += 10;
        if (topic.due_date) score += 5;
        if (contactCount > 0) score += 10;
        if (itemCount >= 5) score += 15;
        else if (itemCount >= 1) score += 5;
        if (sources.length >= 3) score += 15;
        else if (sources.length >= 2) score += 10;
        else if (sources.length >= 1) score += 5;
        if (noteContext) score += 10;
        if (topic.summary) score += 10;
        if (daysSinceLastItem !== null && daysSinceLastItem <= 7) score += 10;
        else if (daysSinceLastItem !== null && daysSinceLastItem <= 30) score += 5;

        const { data } = await callClaudeJSON<{
          suggestions: string[];
          missing: string[];
          strengths: string[];
        }>(
          `Evaluate this topic's completeness and provide actionable suggestions.

Return JSON: {
  "suggestions": ["specific actionable suggestion 1", ...],
  "missing": ["what information or content is missing", ...],
  "strengths": ["what's good about this topic's current state", ...]
}`,
          `Topic: ${topic.title}
Description: ${topic.description || 'MISSING'}
Tags: ${(topic.tags as string[] || []).join(', ') || 'NONE'}
Due date: ${topic.due_date || 'NOT SET'}
Status: ${topic.status}
Priority: ${topic.priority || 0}
Has AI summary: ${!!topic.summary}
Has notes: ${!!noteContext}

Items: ${itemCount} total
Sources used: ${sources.join(', ') || 'none'}
Missing sources: ${missingSources.join(', ') || 'none'}
Contacts linked: ${contactCount}
Date range: ${oldestItem?.toLocaleDateString() || 'N/A'} to ${newestItem?.toLocaleDateString() || 'N/A'}
Days since last activity: ${daysSinceLastItem ?? 'N/A'}`
        );

        result = {
          score: Math.min(100, score),
          suggestions: data.suggestions,
          missing: data.missing,
          strengths: data.strengths,
          stats: {
            item_count: itemCount,
            source_count: sources.length,
            sources_used: sources,
            missing_sources: missingSources,
            contact_count: contactCount,
            days_since_activity: daysSinceLastItem,
            has_description: !!topic.description,
            has_tags: !!(topic.tags && (topic.tags as string[]).length > 0),
            has_due_date: !!topic.due_date,
            has_notes: !!noteContext,
            has_summary: !!topic.summary,
          },
        };
        break;
      }

      case 'concept_search': {
        // AI-powered multilingual concept search across all sources
        const { query: conceptQuery, sources: conceptSources } = context;
        if (!conceptQuery) return NextResponse.json({ error: 'Query required' }, { status: 400 });

        // Step 1: AI generates search strategy with multilingual queries
        const { data: strategy } = await callClaudeJSON<{
          concepts: string[];
          search_queries: Array<{
            query: string;
            language: string;
            source: string;
            reasoning: string;
          }>;
          related_terms: Record<string, string[]>;
        }>(
          `You are a multilingual search strategist. Given a user's search concept, generate comprehensive search queries to find ALL related content across communication sources.

Rules:
1. Decompose the concept into its core ideas, synonyms, and related terms
2. Generate queries in English, Spanish (es), and Portuguese (pt)
3. For each source (gmail, calendar, drive, slack, notion), generate source-specific queries using that source's search syntax
4. Think about related concepts, not just literal translations
5. Consider different phrasings people would use in emails, documents, calendar events, and messages
6. Include queries for abbreviations, acronyms, and informal terms
7. Gmail queries can use operators: from:, subject:, after:, has:attachment
8. Slack queries can use: from:, in:, during:

Return JSON:
{
  "concepts": ["core concept 1", "core concept 2"],
  "search_queries": [
    { "query": "search text", "language": "en", "source": "gmail", "reasoning": "why this query" },
    { "query": "texto de búsqueda", "language": "es", "source": "gmail", "reasoning": "por qué" },
    { "query": "texto de pesquisa", "language": "pt", "source": "gmail", "reasoning": "por quê" }
  ],
  "related_terms": {
    "en": ["term1", "term2"],
    "es": ["término1", "término2"],
    "pt": ["termo1", "termo2"]
  }
}`,
          `User's search concept: "${conceptQuery}"
Available sources: ${JSON.stringify(conceptSources || ['gmail', 'calendar', 'drive', 'slack', 'notion', 'link'])}`
        );

        // Step 2: Execute searches using the generated queries
        const searchPromises: Promise<Record<string, unknown>>[] = [];
        const activeSources = conceptSources || ['gmail', 'calendar', 'drive', 'slack', 'notion'];

        // Group queries by source to batch them
        const queriesBySource: Record<string, string[]> = {};
        for (const sq of strategy.search_queries) {
          if (activeSources.includes(sq.source)) {
            if (!queriesBySource[sq.source]) queriesBySource[sq.source] = [];
            queriesBySource[sq.source].push(sq.query);
          }
        }

        // Execute searches for each unique query
        const uniqueQueries = [...new Set(strategy.search_queries.map(q => q.query))].slice(0, 12);

        for (const searchQuery of uniqueQueries) {
          searchPromises.push(
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/search`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
              },
              body: JSON.stringify({
                query: searchQuery,
                sources: activeSources.filter((s: string) => s !== 'link'),
                max_results: 10,
              }),
            }).then(r => r.json()).catch(() => ({ results: [] }))
          );
        }

        const searchResponses = await Promise.all(searchPromises);

        // Aggregate and deduplicate results
        const allResults: Record<string, unknown>[] = [];
        const seenIds = new Set<string>();

        for (const response of searchResponses) {
          const responseResults = (response as Record<string, unknown>).results as Array<{ source: string; items: Array<Record<string, unknown>> }> || [];
          for (const sourceResult of responseResults) {
            for (const item of (sourceResult.items || [])) {
              const key = `${item.source}:${item.external_id}`;
              if (!seenIds.has(key)) {
                seenIds.add(key);
                allResults.push(item);
              }
            }
          }
        }

        // Step 3: AI ranks results by relevance to the original concept
        let rankedResults = allResults;
        if (allResults.length > 0) {
          const { data: ranking } = await callClaudeJSON<{
            ranked: Array<{ index: number; score: number; reason: string }>;
          }>(
            `You are ranking search results by relevance to a CONCEPT (not just keywords). The user searched for: "${conceptQuery}"

Score each result 0.0-1.0 based on conceptual relevance, not just keyword matches. A result about "IVA trimestral" is relevant to "taxes as contractor in Q4" even though the words don't match.

Return JSON: { "ranked": [{ "index": 0, "score": 0.95, "reason": "brief reason" }] }
Only include results with score >= 0.2. Sort by score descending.`,
            `Results:\n${allResults.slice(0, 30).map((r, i) => `${i}. [${r.source}] ${r.title}\n   ${(r.snippet as string || '').substring(0, 150)}`).join('\n')}`
          );

          const rankedMap = new Map(ranking.ranked.map(r => [r.index, r]));
          rankedResults = allResults
            .map((r, i) => ({
              ...r,
              ai_confidence: rankedMap.get(i)?.score || 0,
              ai_reason: rankedMap.get(i)?.reason || '',
            }))
            .filter(r => (r.ai_confidence as number) >= 0.2)
            .sort((a, b) => (b.ai_confidence as number) - (a.ai_confidence as number));
        }

        result = {
          concepts: strategy.concepts,
          related_terms: strategy.related_terms,
          search_queries_used: strategy.search_queries.length,
          total_results: rankedResults.length,
          results: rankedResults.slice(0, 30),
        };
        inputSummary = `Concept search: "${conceptQuery}" \u2192 ${rankedResults.length} results from ${uniqueQueries.length} queries`;
        break;
      }

      case 'reorganize_folders': {
        // AI analyzes current folder structure and suggests improvements
        const { data: allTopics } = await supabase
          .from('topics')
          .select('id, title, description, area, status, folder_id, tags, updated_at, topic_items(count)')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        const { data: allFolders } = await supabase
          .from('folders')
          .select('id, name, parent_id, color, icon, position')
          .eq('user_id', user.id)
          .order('position', { ascending: true });

        const { text } = await callClaude(
          `You are an organizational productivity expert. Analyze this user's folder structure and topic organization, then suggest concrete improvements.

Consider:
1. Are there duplicated or overlapping topics that should be merged?
2. Are topics in the right folders? Should any be moved?
3. Are there logical folder groupings that don't exist yet?
4. Is the folder hierarchy too flat or too deep?
5. Are folders named clearly and consistently?
6. Would new sub-folders improve organization?
7. Are there orphan topics (no folder) that should be organized?
8. Suggest an ideal folder structure based on the actual content

Format your response as:
## Current Assessment
Brief overview of the current state

## Issues Found
- List specific problems

## Suggested Reorganization
### Folder Structure
Show the proposed folder tree with emoji icons

### Move Actions
- Move "Topic Name" → "Folder Name" (reason)

### New Folders to Create
- "Folder Name" (purpose, which topics go here)

### Topics to Merge
- Merge "Topic A" + "Topic B" → "Combined Topic" (reason)

### Topics to Archive
- Archive "Topic Name" (reason)

Be specific and actionable. Reference actual topic and folder names.`,
          `Current Folders (${(allFolders || []).length}):
${(allFolders || []).map((f: Record<string, unknown>) => {
  const parent = (allFolders || []).find((p: Record<string, unknown>) => p.id === f.parent_id);
  return `- ${f.name} ${parent ? `(inside "${(parent as Record<string, unknown>).name}")` : '(root)'} [id: ${f.id}]`;
}).join('\n')}

Current Topics (${(allTopics || []).length}):
${(allTopics || []).map((t: Record<string, unknown>) => {
  const folder = (allFolders || []).find((f: Record<string, unknown>) => f.id === t.folder_id);
  const itemCount = ((t.topic_items as Array<{ count: number }>)?.[0]?.count) || 0;
  return `- "${t.title}" [${t.area}/${t.status}] → ${folder ? `"${(folder as Record<string, unknown>).name}"` : 'No folder'} (${itemCount} items, tags: ${JSON.stringify(t.tags || [])})`;
}).join('\n')}`
        );

        result = { suggestions: text };
        inputSummary = `Folder reorganization analysis for ${(allTopics || []).length} topics in ${(allFolders || []).length} folders`;
        break;
      }

      // ============ CONTACT KNOWLEDGE BASE AGENTS ============

      case 'contact_ask': {
        // AI answers questions about a contact using their full knowledge base
        const { contact_id, question } = context;
        if (!contact_id || !question) return NextResponse.json({ error: 'contact_id and question required' }, { status: 400 });

        const { data: contactData } = await supabase.from('contacts').select('*').eq('id', contact_id).eq('user_id', user.id).single();
        if (!contactData) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        // Gather knowledge base: contact_items + topic_items from linked topics
        const { data: contactItems } = await supabase.from('contact_items').select('*').eq('contact_id', contact_id).eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(30);

        const { data: topicLinks } = await supabase.from('contact_topic_links').select('topic_id, topics(title)').eq('contact_id', contact_id).eq('user_id', user.id);
        const linkedTopicIds = (topicLinks || []).map((l: Record<string, unknown>) => l.topic_id as string);

        let topicItemsCtx = '';
        if (linkedTopicIds.length > 0) {
          const { data: topicItems } = await supabase.from('topic_items').select('title, source, snippet, body, occurred_at, topic_id, metadata').eq('user_id', user.id).in('topic_id', linkedTopicIds).order('occurred_at', { ascending: false }).limit(40);
          const topicTitleMap: Record<string, string> = {};
          for (const l of (topicLinks || [])) {
            const t = (l.topics as unknown) as { title: string } | null;
            if (t) topicTitleMap[l.topic_id as string] = t.title;
          }
          topicItemsCtx = (topicItems || []).map((i: Record<string, unknown>) => {
            const body = (i.body as string) || (i.snippet as string) || '';
            const preview = body.length > 1500 ? body.substring(0, 1500) + '...' : body;
            return `[${i.source} — Topic: ${topicTitleMap[i.topic_id as string] || 'Unknown'}] ${i.title} (${i.occurred_at})\n${preview}`;
          }).join('\n\n');
        }

        const contactItemsCtx = (contactItems || []).map((i: Record<string, unknown>) => {
          const body = (i.body as string) || (i.snippet as string) || '';
          const preview = body.length > 1500 ? body.substring(0, 1500) + '...' : body;
          return `[Direct ${i.source}] ${i.title} (${i.occurred_at})\n${preview}`;
        }).join('\n\n');

        inputSummary = `Ask about ${contactData.name}: ${question}`;
        const { text } = await callClaude(
          `You are an AI assistant with access to a complete knowledge base about a specific person. Answer the user's question based ONLY on the provided context. Cite specific items (emails, documents, notes, meetings) when making claims. If the information is not in the context, say so clearly. Be concise but thorough.`,
          `=== CONTACT PROFILE ===
Name: ${contactData.name}
Email: ${contactData.email || 'N/A'}
Organization: ${contactData.organization || 'N/A'}
Role: ${contactData.role || 'N/A'}
Notes: ${contactData.notes || 'None'}

=== DIRECT CONTACT ITEMS (notes, documents, links attached to this contact) ===
${contactItemsCtx || 'None'}

=== TOPIC ITEMS (from ${linkedTopicIds.length} linked topics) ===
${topicItemsCtx || 'None'}

=== QUESTION ===
${question}`
        );

        result = { answer: text, sources_used: (contactItems?.length || 0) + (linkedTopicIds.length > 0 ? 40 : 0) };
        break;
      }

      case 'contact_meeting_prep': {
        // AI prepares a briefing for meeting with a contact
        const { contact_id: meetContactId } = context;
        if (!meetContactId) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });

        const { data: contactData } = await supabase.from('contacts').select('*').eq('id', meetContactId).eq('user_id', user.id).single();
        if (!contactData) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        const { data: contactItems } = await supabase.from('contact_items').select('*').eq('contact_id', meetContactId).eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(20);

        const { data: topicLinks } = await supabase.from('contact_topic_links').select('topic_id, role, topics(title, status, due_date, priority, summary, notes)').eq('contact_id', meetContactId).eq('user_id', user.id);
        const linkedTopicIds = (topicLinks || []).map((l: Record<string, unknown>) => l.topic_id as string);

        let topicItemsCtx = '';
        if (linkedTopicIds.length > 0) {
          const { data: topicItems } = await supabase.from('topic_items').select('title, source, snippet, body, occurred_at, topic_id').eq('user_id', user.id).in('topic_id', linkedTopicIds).order('occurred_at', { ascending: false }).limit(30);
          topicItemsCtx = (topicItems || []).map((i: Record<string, unknown>) => {
            const body = (i.body as string) || (i.snippet as string) || '';
            const preview = body.length > 1000 ? body.substring(0, 1000) + '...' : body;
            return `[${i.source}] ${i.title} (${i.occurred_at}): ${preview}`;
          }).join('\n');
        }

        const topicsCtx = (topicLinks || []).map((l: Record<string, unknown>) => {
          const t = l.topics as Record<string, unknown> | null;
          if (!t) return '';
          return `- ${t.title} (status: ${t.status}, priority: ${t.priority || 'N/A'}, due: ${t.due_date || 'N/A'}, role: ${l.role || 'N/A'})\n  Summary: ${(t.summary as string || 'No summary').substring(0, 300)}\n  Notes: ${(t.notes as string || 'None').substring(0, 200)}`;
        }).filter(Boolean).join('\n');

        const contactItemsCtx = (contactItems || []).map((i: Record<string, unknown>) => {
          const body = (i.body as string) || (i.snippet as string) || '';
          const preview = body.length > 800 ? body.substring(0, 800) + '...' : body;
          return `[${i.source}] ${i.title} (${i.occurred_at}): ${preview}`;
        }).join('\n');

        inputSummary = `Meeting prep for ${contactData.name}`;
        const { data: prepData } = await callClaudeJSON<{
          relationship_summary: string;
          recent_topics: Array<{ topic: string; summary: string; last_activity: string }>;
          pending_items: Array<{ item: string; topic: string; status: string }>;
          suggested_agenda: string[];
          talking_points: string[];
          preparation_notes: string;
        }>(
          `You are an executive assistant preparing a meeting briefing. Analyze ALL available data about this contact and generate a comprehensive, actionable meeting preparation document.

Return JSON: {
  "relationship_summary": "2-3 sentence overview of the relationship and recent dynamics",
  "recent_topics": [{ "topic": "topic name", "summary": "what's happening", "last_activity": "when" }],
  "pending_items": [{ "item": "what needs to be done", "topic": "related topic", "status": "pending|in-progress|blocked" }],
  "suggested_agenda": ["agenda item 1", "agenda item 2", ...],
  "talking_points": ["key point to bring up 1", ...],
  "preparation_notes": "any additional context or warnings the user should know"
}`,
          `=== CONTACT ===
Name: ${contactData.name}
Email: ${contactData.email || 'N/A'}
Organization: ${contactData.organization || 'N/A'}
Role: ${contactData.role || 'N/A'}
Last Interaction: ${contactData.last_interaction_at || 'N/A'}
Interactions: ${contactData.interaction_count}
Notes: ${contactData.notes || 'None'}

=== LINKED TOPICS (${(topicLinks || []).length}) ===
${topicsCtx || 'None'}

=== DIRECT ITEMS (notes, documents) ===
${contactItemsCtx || 'None'}

=== RECENT COMMUNICATIONS ===
${topicItemsCtx || 'None'}`
        );

        result = prepData;
        break;
      }

      case 'contact_pending_items': {
        // AI extracts all pending/open items across all contexts for a contact
        const { contact_id: pendingContactId } = context;
        if (!pendingContactId) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });

        const { data: contactData } = await supabase.from('contacts').select('name, email').eq('id', pendingContactId).eq('user_id', user.id).single();
        if (!contactData) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        const { data: contactItems } = await supabase.from('contact_items').select('title, source, body, snippet, occurred_at').eq('contact_id', pendingContactId).eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(20);

        const { data: topicLinks } = await supabase.from('contact_topic_links').select('topic_id, topics(title, status, due_date, priority)').eq('contact_id', pendingContactId).eq('user_id', user.id);
        const linkedTopicIds = (topicLinks || []).map((l: Record<string, unknown>) => l.topic_id as string);
        const topicTitleMap: Record<string, string> = {};
        for (const l of (topicLinks || [])) {
          const t = (l.topics as unknown) as { title: string } | null;
          if (t) topicTitleMap[l.topic_id as string] = t.title;
        }

        let topicItemsCtx = '';
        if (linkedTopicIds.length > 0) {
          const { data: topicItems } = await supabase.from('topic_items').select('title, source, snippet, body, occurred_at, topic_id').eq('user_id', user.id).in('topic_id', linkedTopicIds).order('occurred_at', { ascending: false }).limit(40);
          topicItemsCtx = (topicItems || []).map((i: Record<string, unknown>) => {
            const body = (i.body as string) || (i.snippet as string) || '';
            const preview = body.length > 1000 ? body.substring(0, 1000) + '...' : body;
            return `[${i.source} — ${topicTitleMap[i.topic_id as string] || 'Topic'}] ${i.title} (${i.occurred_at}): ${preview}`;
          }).join('\n');
        }

        const contactItemsCtx = (contactItems || []).map((i: Record<string, unknown>) => {
          const body = (i.body as string) || (i.snippet as string) || '';
          return `[Direct ${i.source}] ${i.title} (${i.occurred_at}): ${body.substring(0, 500)}`;
        }).join('\n');

        inputSummary = `Pending items for ${contactData.name}`;
        const { data: pendingData } = await callClaudeJSON<{
          pending_items: Array<{ task: string; topic: string; priority: 'high' | 'medium' | 'low'; source: string; status: string; context: string }>;
        }>(
          `Analyze ALL communications and documents related to this contact. Extract every pending task, commitment, follow-up, open question, or unresolved item.

Look for:
- Explicit commitments ("I'll send you...", "Let me check...")
- Implicit promises or action items
- Unanswered questions
- Follow-ups mentioned but not completed
- Deadlines or time-sensitive items

Return JSON: { "pending_items": [{ "task": "description", "topic": "related topic name or 'General'", "priority": "high|medium|low", "source": "where this was found", "status": "pending|in-progress|blocked", "context": "brief context why this is pending" }] }`,
          `Contact: ${contactData.name} (${contactData.email || 'no email'})

=== DIRECT ITEMS ===
${contactItemsCtx || 'None'}

=== TOPIC ITEMS (${linkedTopicIds.length} linked topics) ===
${topicItemsCtx || 'None'}`
        );

        result = pendingData;
        break;
      }

      case 'contact_dossier': {
        // AI generates a comprehensive dossier about a contact
        const { contact_id: dossierContactId } = context;
        if (!dossierContactId) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });

        const { data: contactData } = await supabase.from('contacts').select('*').eq('id', dossierContactId).eq('user_id', user.id).single();
        if (!contactData) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

        const { data: contactItems } = await supabase.from('contact_items').select('*').eq('contact_id', dossierContactId).eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(30);

        const { data: topicLinks } = await supabase.from('contact_topic_links').select('topic_id, role, topics(title, status, due_date, priority, summary, area)').eq('contact_id', dossierContactId).eq('user_id', user.id);
        const linkedTopicIds = (topicLinks || []).map((l: Record<string, unknown>) => l.topic_id as string);

        let topicItemsCtx = '';
        if (linkedTopicIds.length > 0) {
          const { data: topicItems } = await supabase.from('topic_items').select('title, source, snippet, body, occurred_at, topic_id, metadata').eq('user_id', user.id).in('topic_id', linkedTopicIds).order('occurred_at', { ascending: false }).limit(60);
          const topicTitleMap: Record<string, string> = {};
          for (const l of (topicLinks || [])) {
            const t = (l.topics as unknown) as { title: string } | null;
            if (t) topicTitleMap[l.topic_id as string] = t.title;
          }
          topicItemsCtx = (topicItems || []).map((i: Record<string, unknown>) => {
            const body = (i.body as string) || (i.snippet as string) || '';
            const preview = body.length > 1500 ? body.substring(0, 1500) + '...' : body;
            return `[${i.source} — ${topicTitleMap[i.topic_id as string] || 'Topic'}] ${i.title} (${i.occurred_at})\n${preview}`;
          }).join('\n\n');
        }

        const topicsCtx = (topicLinks || []).map((l: Record<string, unknown>) => {
          const t = l.topics as Record<string, unknown> | null;
          if (!t) return '';
          return `- ${t.title} (${t.status}, area: ${t.area || 'N/A'}, role: ${l.role || 'N/A'}, due: ${t.due_date || 'N/A'})\n  ${(t.summary as string || 'No summary').substring(0, 200)}`;
        }).filter(Boolean).join('\n');

        const contactItemsCtx = (contactItems || []).map((i: Record<string, unknown>) => {
          const body = (i.body as string) || (i.snippet as string) || '';
          const preview = body.length > 1500 ? body.substring(0, 1500) + '...' : body;
          return `[${i.source}] ${i.title} (${i.occurred_at})\n${preview}`;
        }).join('\n\n');

        inputSummary = `Full dossier for ${contactData.name}`;
        const { text } = await callClaude(
          `You are an executive intelligence analyst. Generate a COMPREHENSIVE dossier about this contact based on ALL available data. Use markdown formatting.

Structure:
## Profile Summary
Brief overview of who this person is and the relationship.

## Communication History
Chronological summary of key interactions, organized by timeframe.

## Key Discussion Themes
Major topics and themes discussed with this person.

## Decisions & Agreements
Key decisions made together, agreements reached.

## Outstanding Items
Tasks, follow-ups, or commitments that are still open.

## Relationship Trajectory
How the relationship has evolved over time, current status, trajectory.

## Key Documents
Important documents, notes, or artifacts related to this person.

## Strategic Notes
Any important observations or recommendations for managing this relationship.

Be specific — cite dates, document names, and concrete details. Don't make up information.`,
          `=== CONTACT PROFILE ===
Name: ${contactData.name}
Email: ${contactData.email || 'N/A'}
Organization: ${contactData.organization || 'N/A'}
Role: ${contactData.role || 'N/A'}
Area: ${contactData.area || 'N/A'}
Created: ${contactData.created_at}
Last Interaction: ${contactData.last_interaction_at || 'Never'}
Total Interactions: ${contactData.interaction_count}
Notes: ${contactData.notes || 'None'}

=== LINKED TOPICS (${(topicLinks || []).length}) ===
${topicsCtx || 'None'}

=== DIRECT CONTACT ITEMS (notes, documents, links) ===
${contactItemsCtx || 'None'}

=== ALL COMMUNICATIONS (from linked topics) ===
${topicItemsCtx || 'None'}`
        );

        result = { dossier: text };
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
      input_summary: inputSummary || `Agent ${agent} run`,
      output_json: result,
    });

    return NextResponse.json({ result });
  } catch (err) {
    console.error('Agent error:', err);
    return NextResponse.json({ error: 'Agent failed: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 });
  }
}
