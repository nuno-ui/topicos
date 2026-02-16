import { SupabaseClient } from '@supabase/supabase-js';

interface ContactBasic {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Check if a topic_item mentions a contact by checking metadata fields
 */
function itemMentionsContact(item: Record<string, unknown>, contact: ContactBasic): boolean {
  const meta = (item.metadata as Record<string, unknown>) || {};
  const contactEmail = (contact.email || '').toLowerCase();
  const contactName = (contact.name || '').toLowerCase();

  if (!contactEmail && !contactName) return false;

  // Check common metadata fields
  const fieldsToCheck = ['from', 'to', 'cc', 'bcc', 'attendees', 'username', 'creator'];
  for (const field of fieldsToCheck) {
    const val = meta[field];
    if (!val) continue;
    const str = typeof val === 'string' ? val.toLowerCase() : JSON.stringify(val).toLowerCase();
    if (contactEmail && str.includes(contactEmail)) return true;
    if (contactName && contactName.length > 2 && str.includes(contactName)) return true;
  }

  // Also check title, snippet, and body content for mentions
  const fullText = `${(item.title as string || '')} ${(item.snippet as string || '')} ${(item.body as string || '')}`.toLowerCase();
  if (contactEmail && contactEmail.length > 3 && fullText.includes(contactEmail)) return true;
  if (contactName && contactName.length > 3 && fullText.includes(contactName)) return true;

  return false;
}

/**
 * Compute interaction stats for a contact based on topic_items
 */
export async function computeContactStats(
  supabase: SupabaseClient,
  userId: string,
  contact: ContactBasic
): Promise<{ count: number; lastAt: string | null; topicIds: string[] }> {
  const { data: items } = await supabase
    .from('topic_items')
    .select('occurred_at, topic_id, title, snippet, body, metadata')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(500);

  if (!items || items.length === 0) {
    return { count: 0, lastAt: null, topicIds: [] };
  }

  let count = 0;
  let lastAt: string | null = null;
  const topicIds = new Set<string>();

  for (const item of items) {
    if (itemMentionsContact(item as Record<string, unknown>, contact)) {
      count++;
      if (!lastAt) lastAt = item.occurred_at;
      topicIds.add(item.topic_id);
    }
  }

  return { count, lastAt, topicIds: Array.from(topicIds) };
}

/**
 * Update a contact's interaction stats in the database
 */
export async function updateContactStats(
  supabase: SupabaseClient,
  userId: string,
  contact: ContactBasic
): Promise<{ count: number; lastAt: string | null }> {
  const stats = await computeContactStats(supabase, userId, contact);

  await supabase
    .from('contacts')
    .update({
      interaction_count: stats.count,
      last_interaction_at: stats.lastAt,
    })
    .eq('id', contact.id)
    .eq('user_id', userId);

  return { count: stats.count, lastAt: stats.lastAt };
}

/**
 * Get all topic_items that mention a specific contact
 */
export async function getContactItems(
  supabase: SupabaseClient,
  userId: string,
  contact: ContactBasic,
  limit: number = 50
): Promise<Array<Record<string, unknown>>> {
  const { data: items } = await supabase
    .from('topic_items')
    .select('id, title, snippet, body, source, source_account_id, external_id, url, occurred_at, topic_id, metadata, topics(title)')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(500);

  if (!items) return [];

  return items
    .filter((item: Record<string, unknown>) => itemMentionsContact(item, contact))
    .slice(0, limit);
}

/**
 * Get engagement level based on interaction data
 */
export function getEngagementLevel(lastInteractionAt: string | null, interactionCount: number): {
  label: string;
  color: string;
  dotColor: string;
  level: 'active' | 'recent' | 'idle' | 'cold' | 'new';
  daysSince: number;
} {
  if (!lastInteractionAt || interactionCount === 0) {
    return { label: 'New', color: 'text-gray-500 bg-gray-50', dotColor: 'bg-gray-300', level: 'new', daysSince: -1 };
  }

  const daysSince = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince <= 7) return { label: 'Active', color: 'text-green-600 bg-green-50', dotColor: 'bg-green-400', level: 'active', daysSince };
  if (daysSince <= 30) return { label: 'Recent', color: 'text-blue-600 bg-blue-50', dotColor: 'bg-blue-400', level: 'recent', daysSince };
  if (daysSince <= 90) return { label: 'Idle', color: 'text-amber-600 bg-amber-50', dotColor: 'bg-amber-400', level: 'idle', daysSince };
  return { label: 'Cold', color: 'text-red-600 bg-red-50', dotColor: 'bg-red-400', level: 'cold', daysSince };
}

/**
 * Compute a contact's communication frequency score (0-100)
 */
export function getCommunicationScore(interactionCount: number, daysSince: number): number {
  if (interactionCount === 0 || daysSince < 0) return 0;
  // Higher score for more frequent, more recent interactions
  const recencyBonus = daysSince <= 7 ? 40 : daysSince <= 30 ? 25 : daysSince <= 90 ? 10 : 0;
  const frequencyScore = Math.min(60, interactionCount * 5);
  return Math.min(100, recencyBonus + frequencyScore);
}
