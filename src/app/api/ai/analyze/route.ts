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
      .select('contact_id, role, contacts(name, email, organization, role)')
      .eq('topic_id', topic_id);

    const system = `You are a brilliant executive assistant analyzing a topic/project and ALL its linked communications, events, and files from multiple sources (email, calendar, drive, slack, notion, notes, links).

You have access to FULL CONTENT of emails, documents, and messages (not just snippets) — read them carefully and extract specific details.

The topic may include user-written notes that provide direct context, decisions, and observations. Give these notes HIGH importance as they represent the user's own knowledge and perspective.

CRITICAL ANALYSIS RULES:
1. READ FULL EMAIL BODIES: Don't just look at subjects — the actual email body contains decisions, commitments, and action items
2. READ EMAIL SIGNATURES: They contain job titles, organizations, and phone numbers
3. READ SLACK CONTEXT: Surrounding channel messages provide conversation context beyond the single message
4. READ ATTACHMENTS: If attachment content is included, analyze it thoroughly
5. CROSS-REFERENCE: Connect information across sources — an email might reference a Slack discussion, a calendar event might follow up on an email
6. IDENTIFY THE USER: The topic owner is the person whose email appears in "From:" for sent emails and "To:" for received emails. Don't confuse them with contacts.
7. UNDERSTAND THREAD FLOW: Emails and Slack messages form conversations. Track who said what and when.

Your analysis MUST include these sections:

## Summary
A concise 2-3 sentence summary of what this topic is about, its current state, and what needs attention.

## Key People
List each person involved with:
- Their name and role/title (extracted from email signatures, calendar entries, or content context)
- Their organization (from email domain or explicit mentions)
- Their involvement level (decision-maker, contributor, informed, mentioned)
- Key contribution to this topic

## Status & Progress
- Current state of the topic/project
- What has been accomplished
- What's currently in progress
- Any recent changes or updates

## Next Steps
3-5 specific, actionable next steps. For each:
- What needs to be done
- Who should do it (reference specific people)
- Suggested timeline based on the communications

## Blockers & Risks
- Pending decisions or approvals
- Unresolved questions
- Dependencies or waiting items
- Potential risks identified from the communications

## Timeline
Key dates and events in chronological order, including:
- Past: meetings held, emails exchanged, decisions made
- Upcoming: scheduled events, deadlines, follow-ups needed

Be specific and reference actual items, dates, and people. Use bullet points. Keep it concise but thorough.`;

    // Track total content size to stay within AI token limits
    let totalContentSize = 0;
    const MAX_TOTAL_CONTENT = 40000; // Increased from 30k for richer analysis
    const MAX_PER_ITEM = 3000; // Increased from 2k per item

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
      if (meta.bcc) details += `\n   BCC: ${meta.bcc}`;
      if (meta.attendees) {
        const attendees = meta.attendees;
        if (Array.isArray(attendees)) {
          details += `\n   Attendees: ${attendees.map((a: Record<string, unknown> | string) => typeof a === 'string' ? a : `${a.email || ''} (${a.displayName || a.name || ''}, ${a.responseStatus || ''})`).join('; ')}`;
        }
      }
      if (meta.channel_name) details += `\n   Channel: #${meta.channel_name}`;
      if (meta.username) details += `\n   Slack user: ${meta.username}`;
      if (meta.conference_link) details += `\n   Conference: ${meta.conference_link}`;
      if (meta.has_attachments) {
        details += `\n   Attachments: ${(meta.attachment_names as string[] || []).join(', ') || 'yes'}`;
        if (meta.attachments_read) details += ' (content extracted)';
      }
      if (meta.has_thread) details += `\n   [Has Slack thread with ${meta.thread_message_count || 0} messages]`;
      if (meta.has_channel_context) details += `\n   [Surrounding channel context: ${meta.channel_context_count || 0} messages]`;
      details += `\n   Date: ${item.occurred_at}`;
      return details;
    }).join('\n\n');

    const contactsList = contactLinks && contactLinks.length > 0
      ? '\n\nKnown contacts linked to this topic:\n' + contactLinks.map((cl: Record<string, unknown>) => {
          const contact = cl.contacts as Record<string, string> | null;
          return `- ${contact?.name || 'Unknown'} (${contact?.email || ''}) — Role in topic: ${cl.role || 'not specified'} · Organization: ${contact?.organization || 'unknown'} · Title: ${(contact as Record<string, string> | null)?.role || 'unknown'}`;
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
Priority: ${topic.priority || 0}
${contactsList}
${noteContext}

Linked Items (${(items || []).length} total from all sources):
${itemsList}

${question ? `\nSpecific question to address: ${question}` : ''}`;

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
