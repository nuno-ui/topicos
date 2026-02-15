import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getTopicNoteContext(topicId: string): Promise<string> {
  const supabase = await createServerSupabaseClient();

  // Get topic.notes (quick notes / scratchpad)
  const { data: topic } = await supabase
    .from('topics')
    .select('notes')
    .eq('id', topicId)
    .single();

  // Get manual topic_items (individual notes)
  const { data: manualItems } = await supabase
    .from('topic_items')
    .select('title, snippet, metadata, occurred_at')
    .eq('topic_id', topicId)
    .eq('source', 'manual')
    .order('occurred_at', { ascending: false })
    .limit(20);

  const parts: string[] = [];

  if (topic?.notes) {
    parts.push(`Quick Notes:\n${topic.notes}`);
  }

  if (manualItems && manualItems.length > 0) {
    const notesList = manualItems.map((n: Record<string, unknown>, i: number) => {
      const meta = n.metadata as Record<string, unknown> || {};
      const content = (meta.content as string) || (n.snippet as string) || '';
      return `${i + 1}. [Note] ${n.title}\n   ${content.substring(0, 500)}\n   Date: ${n.occurred_at}`;
    }).join('\n\n');
    parts.push(`Manual Notes (${manualItems.length}):\n${notesList}`);
  }

  return parts.length > 0 ? '\n\n--- User Notes ---\n' + parts.join('\n\n') : '';
}
