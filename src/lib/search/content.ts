/**
 * Content Enrichment Service — orchestrates deep content fetching from all sources.
 * Fetches full document/email/message body and stores in topic_items.body field.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getValidGoogleToken } from '@/lib/auth/google-tokens';
import { getGmailMessageBody } from './gmail';
import { getDriveFileContent } from './drive-content';
import { getNotionPageContent } from './notion';
import { getSlackThread, formatSlackThread } from './slack';

export interface EnrichedContent {
  body: string;
  attachments?: string[];
  extra_metadata?: Record<string, unknown>;
}

/**
 * Fetch full content for a topic item based on its source.
 * Returns the enriched body text and any additional metadata.
 */
export async function enrichItemContent(
  userId: string,
  item: {
    id: string;
    source: string;
    source_account_id: string | null;
    external_id: string;
    body?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<EnrichedContent> {
  // If body is already populated and cached, return it
  if (item.body && item.body.length > 0) {
    return { body: item.body };
  }

  try {
    switch (item.source) {
      case 'gmail': {
        if (!item.source_account_id) return { body: '' };
        const { accessToken } = await getValidGoogleToken(item.source_account_id);
        const { body, attachments, cc, bcc } = await getGmailMessageBody(accessToken, item.external_id);
        return {
          body,
          attachments,
          extra_metadata: { cc, bcc, has_attachments: attachments.length > 0, attachment_count: attachments.length },
        };
      }

      case 'drive': {
        if (!item.source_account_id) return { body: '' };
        const { accessToken } = await getValidGoogleToken(item.source_account_id);
        const mimeType = (item.metadata?.mimeType as string) || '';
        const { content, exportedAs } = await getDriveFileContent(accessToken, item.external_id, mimeType);
        return {
          body: content,
          extra_metadata: { exported_as: exportedAs },
        };
      }

      case 'notion': {
        if (!item.source_account_id) {
          console.warn(`[Content Enrichment] Notion item ${item.id} missing source_account_id — cannot fetch page content`);
          return { body: '' };
        }
        const notionSupabase = createServiceClient();
        const { data: notionAccount } = await notionSupabase
          .from('notion_accounts')
          .select('access_token')
          .eq('id', item.source_account_id)
          .single();
        if (!notionAccount) {
          console.warn(`[Content Enrichment] Notion account ${item.source_account_id} not found for item ${item.id}`);
          return { body: '' };
        }
        const notionContent = await getNotionPageContent(notionAccount.access_token, item.external_id, 100);
        if (!notionContent) {
          console.warn(`[Content Enrichment] Notion page ${item.external_id} returned empty content`);
        }
        return { body: notionContent };
      }

      case 'slack': {
        if (!item.source_account_id) return { body: '' };
        const supabase = createServiceClient();
        const { data: account } = await supabase
          .from('slack_accounts')
          .select('access_token')
          .eq('id', item.source_account_id)
          .single();
        if (!account) return { body: '' };

        const channelId = (item.metadata?.channel_id as string) || '';
        const threadTs = (item.metadata?.thread_ts as string) || item.external_id.split('-').pop() || '';

        if (!channelId || !threadTs) return { body: '' };

        const { messages, replyCount } = await getSlackThread(account.access_token, channelId, threadTs);
        const body = formatSlackThread(messages);
        return {
          body,
          extra_metadata: { reply_count: replyCount, thread_message_count: messages.length },
        };
      }

      case 'calendar': {
        // Calendar items store full description in snippet already (after our fix)
        // No additional content to fetch beyond what's in metadata
        return { body: '' };
      }

      case 'manual': {
        // Manual notes store content in metadata.content
        return { body: (item.metadata?.content as string) || '' };
      }

      case 'link': {
        const { fetchLinkContent } = await import('./link-content');
        const url = item.external_id || (item.metadata as Record<string, string>)?.url || '';
        if (!url) return { body: '' };
        const content = await fetchLinkContent(url);
        return { body: `Title: ${content.title}\nDescription: ${content.description}\n\n${content.body}` };
      }

      default:
        return { body: '' };
    }
  } catch (err) {
    console.error(`Content enrichment failed for ${item.source}/${item.external_id}:`, err);
    return { body: `[Error fetching content: ${err instanceof Error ? err.message : 'Unknown error'}]` };
  }
}

/**
 * Enrich and cache content for a topic item.
 * Fetches full content and stores it in the topic_items.body field.
 */
export async function enrichAndCacheItemContent(
  userId: string,
  item: {
    id: string;
    topic_id: string;
    source: string;
    source_account_id: string | null;
    external_id: string;
    body?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<EnrichedContent> {
  const result = await enrichItemContent(userId, item);

  if (result.body) {
    const supabase = createServiceClient();
    const updateData: Record<string, unknown> = { body: result.body };

    // Merge extra metadata if present
    if (result.extra_metadata) {
      updateData.metadata = { ...(item.metadata || {}), ...result.extra_metadata };
    }

    const { error } = await supabase
      .from('topic_items')
      .update(updateData)
      .eq('id', item.id);

    if (error) {
      console.error(`[Content Enrichment] Failed to save body for item ${item.id} (${item.source}):`, error.message);
    } else {
      console.log(`[Content Enrichment] ✓ Saved ${result.body.length} chars for ${item.source} item ${item.id}`);
    }
  } else {
    console.warn(`[Content Enrichment] No content returned for ${item.source} item ${item.id} (external_id: ${item.external_id})`);
  }

  return result;
}

/**
 * Enrich all items for a topic (batch operation for AI Deep Dive).
 * Fetches content in parallel batches to avoid rate limits.
 */
export async function enrichTopicItems(
  userId: string,
  topicId: string
): Promise<{ enriched: number; failed: number; items: Array<{ id: string; body: string }> }> {
  const supabase = createServiceClient();
  const { data: items } = await supabase
    .from('topic_items')
    .select('id, topic_id, source, source_account_id, external_id, body, metadata')
    .eq('topic_id', topicId)
    .order('occurred_at', { ascending: false })
    .limit(30);

  if (!items || items.length === 0) return { enriched: 0, failed: 0, items: [] };

  let enriched = 0;
  let failed = 0;
  const results: Array<{ id: string; body: string }> = [];

  // Process in batches of 5 to respect API rate limits
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await enrichAndCacheItemContent(userId, item);
          if (result.body) {
            enriched++;
            return { id: item.id, body: result.body };
          } else {
            return { id: item.id, body: item.body || '' };
          }
        } catch {
          failed++;
          return { id: item.id, body: item.body || '' };
        }
      })
    );
    results.push(...batchResults);
  }

  return { enriched, failed, items: results };
}
