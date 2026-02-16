import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get topic with all data
  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  // Get items
  const { data: items } = await supabase
    .from('topic_items')
    .select('*')
    .eq('topic_id', id)
    .order('occurred_at', { ascending: false });

  // Get contacts
  const { data: contactLinks } = await supabase
    .from('contact_topic_links')
    .select('role, contacts(name, email, organization)')
    .eq('topic_id', id);

  // Build markdown report
  const lines: string[] = [];

  lines.push(`# ${topic.title}`);
  lines.push('');
  lines.push(`**Status:** ${topic.status} | **Area:** ${topic.area} | **Priority:** ${topic.priority || 'Not set'}`);
  if (topic.due_date) lines.push(`**Due Date:** ${new Date(topic.due_date).toLocaleDateString()}`);
  if (topic.description) {
    lines.push('');
    lines.push(`## Description`);
    lines.push(topic.description);
  }
  if (topic.tags && topic.tags.length > 0) {
    lines.push('');
    lines.push(`**Tags:** ${topic.tags.join(', ')}`);
  }

  // AI Summary
  if (topic.summary) {
    lines.push('');
    lines.push('## AI Analysis');
    lines.push(topic.summary);
  }

  // Contacts
  if (contactLinks && contactLinks.length > 0) {
    lines.push('');
    lines.push('## Contacts');
    for (const cl of contactLinks) {
      const contact = cl.contacts as unknown as { name: string; email: string; organization: string } | null;
      if (contact) {
        lines.push(`- **${contact.name}** (${contact.email || 'no email'}) — ${cl.role || 'role unknown'}${contact.organization ? ` at ${contact.organization}` : ''}`);
      }
    }
  }

  // Items
  if (items && items.length > 0) {
    lines.push('');
    lines.push(`## Linked Items (${items.length})`);
    lines.push('');

    // Group by source
    const bySource: Record<string, typeof items> = {};
    for (const item of items) {
      if (!bySource[item.source]) bySource[item.source] = [];
      bySource[item.source].push(item);
    }

    for (const [source, sourceItems] of Object.entries(bySource)) {
      const sourceLabels: Record<string, string> = { gmail: 'Email', calendar: 'Calendar', drive: 'Drive', slack: 'Slack', notion: 'Notion', manual: 'Notes' };
      lines.push(`### ${sourceLabels[source] || source} (${sourceItems.length})`);
      lines.push('');
      for (const item of sourceItems) {
        const date = new Date(item.occurred_at).toLocaleDateString();
        const meta = item.metadata as Record<string, unknown> || {};
        let details = `- **${item.title}** — ${date}`;
        if (item.url) details += ` — [Open](${item.url})`;
        lines.push(details);
        if (meta.from) lines.push(`  From: ${meta.from}`);
        if (item.snippet) lines.push(`  > ${item.snippet.substring(0, 200)}`);
      }
      lines.push('');
    }
  }

  // Notes
  if (topic.notes) {
    lines.push('## Quick Notes');
    lines.push(topic.notes);
    lines.push('');
  }

  // Metadata
  lines.push('---');
  lines.push(`*Exported from TopicOS on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*`);
  lines.push(`*Topic created: ${new Date(topic.created_at).toLocaleDateString()} | Last updated: ${new Date(topic.updated_at).toLocaleDateString()}*`);

  const markdown = lines.join('\n');
  const filename = `${topic.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_report.md`;

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
