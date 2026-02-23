import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaude, callClaudeJSON } from '@/lib/ai/provider';
import { enrichTopicItems } from '@/lib/search/content';
import { getTopicNoteContext } from '@/lib/ai/note-context';
import { getAncestorContext, getAncestorItems, buildGroundTruthSection } from '@/lib/ai/topic-hierarchy';

async function getTopicTasksContext(topicId: string, supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>): Promise<string> {
  try {
    const { data: tasks } = await supabase
      .from('topic_tasks')
      .select('title, description, status, priority, due_date, assignee, source, created_at')
      .eq('topic_id', topicId)
      .neq('status', 'archived')
      .order('position', { ascending: true })
      .limit(30);
    if (!tasks || tasks.length === 0) return '';
    const statusLabel = (s: string) => s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
    const priorityLabel = (p: string) => p === 'high' ? '🔴 High' : p === 'medium' ? '🟡 Medium' : '🟢 Low';
    const taskLines = tasks.map((t: { title: string; description: string; status: string; priority: string; due_date: string | null; assignee: string | null; source: string }) => {
      let line = `- [${statusLabel(t.status)}] [${priorityLabel(t.priority)}] ${t.title}`;
      if (t.assignee) line += ` (Responsible: ${t.assignee})`;
      if (t.due_date) line += ` — Due: ${new Date(t.due_date).toLocaleDateString()}`;
      if (t.description) line += `\n  ${t.description}`;
      return line;
    });
    return `\n\n=== TOPIC TASKS ===\n${taskLines.join('\n')}\n===\n`;
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const area = body.area || 'work';

  // Fetch all active topics in area
  const { data: topics } = await supabase
    .from('topics')
    .select('id, title, description, area, status, tags, due_date, goal, summary, parent_topic_id, owner, owner_contact_id')
    .eq('user_id', user.id)
    .eq('area', area)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (!topics || topics.length === 0) {
    return new Response(JSON.stringify({ error: 'No active topics found' }), { status: 404 });
  }

  // Fetch all existing contacts for matching
  const { data: allContacts } = await supabase.from('contacts').select('id, name, email').eq('user_id', user.id);
  const existingContactSet = new Map((allContacts || []).map(c => [c.email?.toLowerCase(), c]));
  const existingContactNames = new Map((allContacts || []).map(c => [c.name?.toLowerCase(), c]));

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'start', total: topics.length });

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        try {
          // Stage 1: Enrich items
          send({ type: 'progress', index: i, total: topics.length, topic: topic.title, stage: 'enrich' });
          const { enriched, failed } = await enrichTopicItems(user.id, topic.id);

          // Stage 2: Find contacts
          send({ type: 'progress', index: i, total: topics.length, topic: topic.title, stage: 'contacts' });
          const { data: items } = await supabase.from('topic_items')
            .select('title, source, snippet, body, metadata')
            .eq('topic_id', topic.id)
            .limit(30);

          let contactsLinked = 0;
          if (items && items.length > 0) {
            try {
              const { data: contactData } = await callClaudeJSON<{
                contacts: Array<{ name: string; email: string; role: string; organization: string }>;
              }>(
                `Extract all people mentioned in these communications. For each person, find their name, email (if available), role/title, and organization.
Do NOT include the user/owner of these communications.
ALREADY KNOWN CONTACTS: ${(allContacts || []).map(c => `${c.name} <${c.email || '?'}>`).join(', ')}
Return JSON: { "contacts": [{ "name": "Full Name", "email": "email@example.com or empty", "role": "their role", "organization": "their org" }] }`,
                `Items:\n${items.map((item: Record<string, unknown>) => {
                  const meta = item.metadata as Record<string, unknown> || {};
                  const content = (item.body as string) || (item.snippet as string) || '';
                  const preview = content.length > 1500 ? content.substring(0, 1500) + '...' : content;
                  let header = `[${item.source}] ${item.title}`;
                  if (meta.from) header += `\nFrom: ${meta.from}`;
                  if (meta.to) header += `\nTo: ${meta.to}`;
                  if (meta.cc) header += `\nCC: ${meta.cc}`;
                  if (meta.attendees) header += `\nAttendees: ${JSON.stringify(meta.attendees)}`;
                  return `${header}\n${preview}`;
                }).join('\n---\n')}`
              );

              // Match extracted contacts to existing ones and link
              for (const extracted of (contactData?.contacts || [])) {
                const emailKey = extracted.email?.toLowerCase();
                const nameKey = extracted.name?.toLowerCase();
                const matched = (emailKey && existingContactSet.get(emailKey)) || (nameKey && existingContactNames.get(nameKey));
                if (matched) {
                  await supabase.from('contact_topic_links').upsert(
                    { user_id: user.id, contact_id: matched.id, topic_id: topic.id },
                    { onConflict: 'contact_id, topic_id' }
                  );
                  contactsLinked++;
                }
              }
            } catch (e) {
              console.error(`Batch enrich contacts error for ${topic.title}:`, e);
            }
          }

          // Stage 3: Deep dive (Intelligence report) — only updates summary
          send({ type: 'progress', index: i, total: topics.length, topic: topic.title, stage: 'deep_dive' });
          try {
            const noteContext = await getTopicNoteContext(topic.id);
            const ancestorCtx = await getAncestorContext(topic.id, supabase);
            const ancestorItems = await getAncestorItems(topic.id, supabase);
            const tasksCtx = await getTopicTasksContext(topic.id, supabase);
            const groundTruth = buildGroundTruthSection(topic);

            const { data: fullItems } = await supabase.from('topic_items')
              .select('title, source, snippet, body, metadata, occurred_at')
              .eq('topic_id', topic.id)
              .order('occurred_at', { ascending: true })
              .limit(30);

            const itemsContent = (fullItems || []).map((item: Record<string, unknown>, idx: number) => {
              const meta = item.metadata as Record<string, unknown> || {};
              const bodyText = (item.body as string) || (item.snippet as string) || '';
              const preview = bodyText.length > 2000 ? bodyText.substring(0, 2000) + '...' : bodyText;
              let details = `\n--- Item ${idx + 1} [${item.source}] ---\nTitle: ${item.title}\nDate: ${item.occurred_at}`;
              if (meta.from) details += `\nFrom: ${meta.from}`;
              if (meta.to) details += `\nTo: ${meta.to}`;
              if (meta.attendees) details += `\nAttendees: ${(meta.attendees as string[]).join(', ')}`;
              if (meta.channel_name) details += `\nChannel: #${meta.channel_name}`;
              details += `\nContent:\n${preview}`;
              return details;
            }).join('\n');

            const { text } = await callClaude(
              `You are performing a DEEP DIVE analysis of a topic/project. You have access to FULL CONTENT of linked items.

CRITICAL INSTRUCTIONS:
- The topic's title and description define its CORE FOCUS.
- READ every email body completely — they contain decisions, commitments, questions, and context
- CROSS-REFERENCE across sources
- TRACK conversation threads

Provide a comprehensive analysis with these sections:
## Executive Summary
3-5 sentences capturing the full picture.

## Detailed Timeline
Chronological breakdown of ALL events with dates and participants.

## Key Decisions Made
Every decision with who, when, what triggered it.

## Action Items & Commitments
Every task/commitment found with responsible person, deadline, status, source.

## People & Roles
Each person involved with name, title, organization, role in topic.

## Risks & Blockers
Unresolved questions, waiting items, potential conflicts.

## Strategic Recommendations
3-5 recommendations with what, why, timeline, and who should lead.

Be EXTREMELY specific. Reference actual content, dates, people.`,
              `${groundTruth}\nTopic: ${topic.title}\nDescription: ${topic.description || 'None'}\nArea: ${topic.area}\nStatus: ${topic.status}\nTags: ${(topic.tags || []).join(', ') || 'None'}\nDue date: ${topic.due_date || 'Not set'}\nGoal: ${topic.goal || 'Not set'}\n${noteContext}\n\nContent enrichment: ${enriched} items enriched, ${failed} failed\n\nFull Content of ${(fullItems || []).length} Linked Items:\n${itemsContent}${tasksCtx}${ancestorCtx}${ancestorItems}`,
              { maxTokens: 6000 }
            );

            await supabase.from('topics').update({
              summary: text,
              updated_at: new Date().toISOString(),
            }).eq('id', topic.id);
          } catch (e) {
            console.error(`Batch enrich deep_dive error for ${topic.title}:`, e);
          }

          send({ type: 'progress', index: i, total: topics.length, topic: topic.title, stage: 'done', enriched, contactsLinked });

          // Rate limiting: 2s delay between topics
          if (i < topics.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (err) {
          send({ type: 'progress', index: i, total: topics.length, topic: topic.title, stage: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      send({ type: 'complete', total: topics.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
