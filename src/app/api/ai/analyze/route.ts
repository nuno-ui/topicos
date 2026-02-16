import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaude } from '@/lib/ai/provider';
import { getTopicNoteContext } from '@/lib/ai/note-context';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { topic_id, question } = body;
    if (!topic_id) return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });

    // Get topic and items
    const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const { data: items } = await supabase.from('topic_items').select('*').eq('topic_id', topic_id).order('occurred_at', { ascending: false });

    // Get contacts linked to this topic
    const { data: contactLinks } = await supabase
      .from('contact_topic_links')
      .select('contact_id, role, contacts(name, email, organization)')
      .eq('topic_id', topic_id);

    const system = `You are a brilliant executive assistant analyzing a topic/project and its linked communications, events, and files. Provide actionable intelligence. You may have access to FULL CONTENT of emails, documents, and messages (not just snippets) — use this rich context for deeper analysis. The topic may include user-written notes that provide direct context, decisions, and observations. Give these notes high importance as they represent the user's own knowledge and perspective.

Your analysis MUST include these sections:

## Summary
A concise 2-3 sentence summary of what this topic is about based on the linked items.

## Key People
List the main people involved (extracted from email senders, event attendees, slack users) and their apparent role/relevance.

## Status & Progress
What's the current state? What has happened recently? Any milestones reached?

## Next Steps
3-5 specific, actionable next steps based on the communications and events.

## Blockers & Risks
Any potential blockers, pending decisions, or risks you can identify from the communications.

## Timeline
Key dates/events in chronological order.

Be specific and reference actual items. Use bullet points. Keep it concise but thorough.`;

    // Track total content size to stay within AI token limits
    let totalContentSize = 0;
    const MAX_TOTAL_CONTENT = 30000;
    const MAX_PER_ITEM = 2000;

    const itemsList = (items || []).map((item: Record<string, unknown>, i: number) => {
      const meta = item.metadata as Record<string, unknown> || {};
      let details = `${i + 1}. [${item.source}] ${item.title}`;

      // Prefer body (full content) over snippet when available
      const bodyContent = item.body as string;
      const snippetContent = item.snippet as string;
      if (bodyContent && totalContentSize < MAX_TOTAL_CONTENT) {
        const truncatedBody = bodyContent.length > MAX_PER_ITEM ? bodyContent.substring(0, MAX_PER_ITEM) + '...' : bodyContent;
        details += `\n   Content: ${truncatedBody}`;
        totalContentSize += truncatedBody.length;
      } else if (snippetContent) {
        details += `\n   Snippet: ${snippetContent}`;
        totalContentSize += snippetContent.length;
      }

      if (meta.from) details += `\n   From: ${meta.from}`;
      if (meta.to) details += `\n   To: ${meta.to}`;
      if (meta.cc) details += `\n   CC: ${meta.cc}`;
      if (meta.attendees) details += `\n   Attendees: ${(meta.attendees as string[]).join(', ')}`;
      if (meta.channel_name) details += `\n   Channel: #${meta.channel_name}`;
      if (meta.username) details += `\n   User: ${meta.username}`;
      if (meta.conference_link) details += `\n   Conference: ${meta.conference_link}`;
      if (meta.has_attachments) details += `\n   Attachments: ${(meta.attachment_names as string[] || []).join(', ') || 'yes'}`;
      details += `\n   Date: ${item.occurred_at}`;
      return details;
    }).join('\n\n');

    const contactsList = contactLinks && contactLinks.length > 0
      ? '\n\nKnown contacts:\n' + contactLinks.map((cl: Record<string, unknown>) => {
          const contact = cl.contacts as Record<string, string> | null;
          return `- ${contact?.name || 'Unknown'} (${contact?.email || ''}) — ${cl.role || 'role unknown'}`;
        }).join('\n')
      : '';

    const noteContext = await getTopicNoteContext(topic_id);

    if ((!items || items.length === 0) && !noteContext) {
      return NextResponse.json({ analysis: 'No items or notes linked to this topic yet. Add notes or search and link items to get AI-powered insights.' });
    }

    const prompt = `Topic: ${topic.title}
Description: ${topic.description || 'No description provided'}
Area: ${topic.area}
Status: ${topic.status}
Tags: ${(topic.tags || []).join(', ') || 'None'}
Due date: ${topic.due_date || 'Not set'}
${contactsList}
${noteContext}

Linked Items (${(items || []).length} total):
${itemsList}

${question ? `\nSpecific question: ${question}` : ''}`;

    const { text, tokensUsed } = await callClaude(system, prompt);

    // Store the summary back on the topic
    await supabase.from('topics').update({
      summary: text,
      updated_at: new Date().toISOString(),
    }).eq('id', topic_id);

    // Log AI run
    await supabase.from('ai_runs').insert({
      user_id: user.id,
      topic_id: topic.id,
      kind: 'analyze_topic',
      model: 'claude-sonnet-4-5-20250929',
      input_summary: `Analyzed "${topic.title}" with ${(items || []).length} linked items`,
      output_json: { analysis_length: text.length },
      tokens_used: tokensUsed,
    });

    return NextResponse.json({ analysis: text });
  } catch (err) {
    console.error('AI analyze error:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
