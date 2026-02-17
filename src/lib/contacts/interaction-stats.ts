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

/**
 * Get a unified knowledge base for a contact — combining direct contact_items,
 * topic_items from linked topics, and mention-based items.
 */
export async function getContactKnowledgeBase(
  supabase: SupabaseClient,
  userId: string,
  contact: ContactBasic,
  options?: { limit?: number; source?: string; search?: string }
): Promise<{
  contactItems: Array<Record<string, unknown>>;
  topicItems: Array<Record<string, unknown>>;
  mentionItems: Array<Record<string, unknown>>;
  allItems: Array<Record<string, unknown>>;
  stats: {
    total: number;
    bySource: Record<string, number>;
    linkedTopics: number;
    dateRange: { oldest: string | null; newest: string | null };
  };
}> {
  const maxItems = options?.limit || 200;

  // 1. Fetch direct contact_items
  let contactItemsQuery = supabase
    .from('contact_items')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(maxItems);

  if (options?.source) contactItemsQuery = contactItemsQuery.eq('source', options.source);

  // 2. Fetch linked topic IDs
  const topicLinksPromise = supabase
    .from('contact_topic_links')
    .select('topic_id, topics(title)')
    .eq('contact_id', contact.id)
    .eq('user_id', userId);

  const [contactItemsRes, topicLinksRes] = await Promise.all([
    contactItemsQuery,
    topicLinksPromise,
  ]);

  const directItems = (contactItemsRes.data || []).map((item: Record<string, unknown>) => ({
    ...item,
    _origin: 'direct' as const,
    _originLabel: 'Direct',
  }));

  const topicLinks = topicLinksRes.data || [];
  const topicIds = topicLinks.map((l: Record<string, unknown>) => l.topic_id as string);
  const topicTitleMap: Record<string, string> = {};
  for (const link of topicLinks) {
    const topics = link.topics as unknown as { title: string } | null;
    if (topics) topicTitleMap[link.topic_id as string] = topics.title;
  }

  // 3. Fetch topic_items from linked topics
  let topicItemsList: Array<Record<string, unknown>> = [];
  if (topicIds.length > 0) {
    let tQuery = supabase
      .from('topic_items')
      .select('id, title, snippet, body, source, url, occurred_at, topic_id, metadata, created_at')
      .eq('user_id', userId)
      .in('topic_id', topicIds)
      .order('occurred_at', { ascending: false })
      .limit(maxItems);

    if (options?.source) tQuery = tQuery.eq('source', options.source);

    const { data } = await tQuery;
    topicItemsList = (data || []).map((item: Record<string, unknown>) => ({
      ...item,
      _origin: 'topic' as const,
      _originLabel: topicTitleMap[item.topic_id as string] || 'Topic',
    }));
  }

  // 4. Fetch mention-based items (items that mention this contact but aren't in linked topics)
  const mentionItems = await getContactItems(supabase, userId, contact, maxItems);
  const topicItemIds = new Set(topicItemsList.map(i => i.id));
  const uniqueMentions = mentionItems
    .filter(item => !topicItemIds.has(item.id as string))
    .map(item => ({
      ...item,
      _origin: 'mention' as const,
      _originLabel: `Mentioned in ${(item.topics as { title: string } | null)?.title || 'topic'}`,
    }));

  // 5. Merge and deduplicate by id
  const seenIds = new Set<string>();
  const allItems: Array<Record<string, unknown>> = [];

  for (const item of [...directItems, ...topicItemsList, ...uniqueMentions] as Array<Record<string, unknown>>) {
    const itemId = item.id as string;
    if (seenIds.has(itemId)) continue;
    seenIds.add(itemId);
    allItems.push(item);
  }

  // Apply search filter if provided
  let filtered = allItems;
  if (options?.search) {
    const q = options.search.toLowerCase();
    filtered = allItems.filter(item => {
      const text = `${item.title || ''} ${item.snippet || ''} ${item.body || ''}`.toLowerCase();
      return text.includes(q);
    });
  }

  // Sort by occurred_at descending
  filtered.sort((a, b) => {
    const aDate = new Date(a.occurred_at as string || a.created_at as string || 0).getTime();
    const bDate = new Date(b.occurred_at as string || b.created_at as string || 0).getTime();
    return bDate - aDate;
  });

  // Compute stats
  const bySource: Record<string, number> = {};
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const item of filtered) {
    const src = item.source as string || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
    const date = item.occurred_at as string || item.created_at as string;
    if (date) {
      if (!oldest || date < oldest) oldest = date;
      if (!newest || date > newest) newest = date;
    }
  }

  return {
    contactItems: directItems,
    topicItems: topicItemsList,
    mentionItems: uniqueMentions,
    allItems: filtered.slice(0, maxItems),
    stats: {
      total: filtered.length,
      bySource,
      linkedTopics: topicIds.length,
      dateRange: { oldest, newest },
    },
  };
}
