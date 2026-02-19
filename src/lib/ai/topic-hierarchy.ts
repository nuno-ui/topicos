import { SupabaseClient } from '@supabase/supabase-js';

interface TopicAncestor {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  goal: string | null;
  parent_topic_id: string | null;
}

/**
 * Walk up the parent_topic_id chain to get ancestor topics.
 * Returns [parent, grandparent] ordered from nearest to farthest.
 * Skips the topic itself — only returns ancestors.
 */
export async function getTopicAncestors(
  topicId: string,
  supabase: SupabaseClient
): Promise<TopicAncestor[]> {
  const ancestors: TopicAncestor[] = [];

  // First get the topic's parent_topic_id
  const { data: topic } = await supabase
    .from('topics')
    .select('parent_topic_id')
    .eq('id', topicId)
    .single();

  if (!topic?.parent_topic_id) return [];

  let currentId: string | null = topic.parent_topic_id;

  // Walk up the chain (max 2 lookups for 3-level hierarchy)
  while (currentId && ancestors.length < 3) {
    const { data } = await supabase
      .from('topics')
      .select('id, title, description, tags, goal, parent_topic_id')
      .eq('id', currentId)
      .single();

    if (!data) break;
    ancestors.push(data);
    currentId = data.parent_topic_id;
  }

  return ancestors;
}

/**
 * Build a formatted context string with ancestor topic info.
 * Used to inject parent/grandparent context into AI agent prompts.
 */
export async function getAncestorContext(
  topicId: string,
  supabase: SupabaseClient
): Promise<string> {
  const ancestors = await getTopicAncestors(topicId, supabase);

  if (ancestors.length === 0) return '';

  const parts = ancestors.map((a, i) => {
    const level = i === 0 ? 'Parent Topic' : 'Grandparent Topic';
    return `${level}: ${a.title}\n  Description: ${a.description || 'None'}\n  Tags: ${(a.tags || []).join(', ') || 'None'}\n  Goal: ${a.goal || 'None'}`;
  });

  return '\n\n--- Topic Hierarchy Context (this is a sub-topic) ---\nThis topic exists within a larger topic hierarchy. Consider the parent context when analyzing:\n' + parts.join('\n\n');
}

/**
 * Fetch items from ancestor topics as supplementary context.
 * These are lower priority than the topic's own items.
 */
export async function getAncestorItems(
  topicId: string,
  supabase: SupabaseClient,
  limitPerAncestor: number = 8
): Promise<string> {
  const ancestors = await getTopicAncestors(topicId, supabase);

  if (ancestors.length === 0) return '';

  const parts: string[] = [];
  for (const ancestor of ancestors) {
    const { data: items } = await supabase
      .from('topic_items')
      .select('title, source, snippet')
      .eq('topic_id', ancestor.id)
      .order('occurred_at', { ascending: false })
      .limit(limitPerAncestor);

    if (items && items.length > 0) {
      const itemsList = items.map((i: { source: string; title: string; snippet: string }) =>
        `  [${i.source}] ${i.title}: ${(i.snippet || '').substring(0, 200)}`
      ).join('\n');
      parts.push(`Items from parent topic "${ancestor.title}" (${items.length}):\n${itemsList}`);
    }
  }

  return parts.length > 0
    ? '\n\n--- Parent Topic Items (supplementary context, lower priority than this topic\'s own items) ---\n' + parts.join('\n\n')
    : '';
}

/**
 * Build a "ground truth" section for AI prompts that emphasizes
 * the user's deliberately-chosen title and description as the core focus.
 * This prevents agents from drifting toward tangential items.
 */
export function buildGroundTruthSection(topic: {
  title: string;
  description: string | null;
  goal?: string | null;
  summary?: string | null;
  next_steps?: Array<{ action: string; priority: string; rationale: string }> | null;
}): string {
  if (!topic.description && !topic.goal) {
    // If no description or goal set, just note the title as the anchor
    let section = `=== TOPIC FOCUS ===\nTitle: ${topic.title}\nNote: The user chose this title deliberately. Keep analysis focused on what this title implies.\n`;
    if (topic.summary) section += `\nPrevious AI Summary:\n${topic.summary}\n`;
    if (topic.next_steps?.length) section += `\nPrevious AI Next Steps:\n${topic.next_steps.map(s => `- [${s.priority}] ${s.action} — ${s.rationale}`).join('\n')}\n`;
    return section + '===\n';
  }

  let section = `=== GROUND TRUTH (CORE FOCUS) ===
The user has DELIBERATELY chosen this title and description. They define the CORE FOCUS of this topic.
ALL analysis MUST be filtered through this lens. Items that are tangential to this stated focus should be acknowledged but de-prioritized.
Do NOT let the volume of tangential items overshadow the core focus.

Title (ground truth): ${topic.title}
${topic.description ? `Description (ground truth): ${topic.description}` : ''}
${topic.goal ? `Goal (ground truth): ${topic.goal}` : ''}`;
  if (topic.summary) section += `\nPrevious AI Summary:\n${topic.summary}`;
  if (topic.next_steps?.length) section += `\nPrevious AI Next Steps:\n${topic.next_steps.map(s => `- [${s.priority}] ${s.action} — ${s.rationale}`).join('\n')}`;
  return section + '\n===\n';
}
