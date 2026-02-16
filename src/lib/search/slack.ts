import { SearchResult } from './gmail';

export async function searchSlack(
  accessToken: string,
  accountId: string,
  query: string,
  maxResults: number = 20
): Promise<SearchResult[]> {
  const res = await fetch('https://slack.com/api/search.messages', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      query,
      count: maxResults.toString(),
      sort: 'timestamp',
      sort_dir: 'desc',
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error('Slack search error:', data.error);
    throw new Error('Slack search failed: ' + data.error);
  }

  const matches = data.messages?.matches ?? [];
  return matches.map((match: Record<string, unknown>) => {
    const channel = match.channel as Record<string, unknown> | undefined;
    const ts = match.ts as string;
    const channelId = (channel?.id as string) ?? '';
    const channelName = (channel?.name as string) ?? 'DM';
    const isDm = (channel?.is_im as boolean) ?? false;
    const isMpim = (channel?.is_mpim as boolean) ?? false;

    let title = '';
    if (isDm || isMpim) {
      title = 'DM: ' + ((match.username as string) ?? 'Unknown');
    } else {
      title = '#' + channelName + ': ' + ((match.username as string) ?? 'Unknown');
    }

    return {
      external_id: channelId + '-' + ts,
      source: 'slack',
      source_account_id: accountId,
      title,
      snippet: ((match.text as string) ?? '').slice(0, 500),
      url: (match.permalink as string) ?? '',
      occurred_at: ts ? new Date(parseFloat(ts) * 1000).toISOString() : new Date().toISOString(),
      metadata: {
        channel_id: channelId,
        channel_name: channelName,
        user_id: match.user ?? '',
        username: match.username ?? '',
        is_dm: isDm,
        is_mpim: isMpim,
        thread_ts: (match.ts as string) ?? '',
        reply_count: ((match as Record<string, unknown>).reply_count as number) ?? 0,
      },
    };
  });
}

/**
 * Fetch a complete Slack thread (all replies) for richer context.
 * Uses conversations.replies API to get the full threaded conversation.
 */
export async function getSlackThread(
  accessToken: string,
  channelId: string,
  threadTs: string
): Promise<{ messages: Array<{ user: string; text: string; ts: string }>; replyCount: number }> {
  try {
    const res = await fetch('https://slack.com/api/conversations.replies', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        channel: channelId,
        ts: threadTs,
        limit: '50',
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack thread fetch error:', data.error);
      return { messages: [], replyCount: 0 };
    }

    const messages = (data.messages ?? []).map((msg: Record<string, unknown>) => ({
      user: (msg.user as string) ?? (msg.username as string) ?? 'unknown',
      text: (msg.text as string) ?? '',
      ts: (msg.ts as string) ?? '',
    }));

    return {
      messages,
      replyCount: Math.max(0, messages.length - 1), // Subtract parent message
    };
  } catch (err) {
    console.error('Slack thread fetch error:', err);
    return { messages: [], replyCount: 0 };
  }
}

/**
 * Format a Slack thread into readable text for AI analysis.
 */
export function formatSlackThread(
  messages: Array<{ user: string; text: string; ts: string }>
): string {
  if (messages.length === 0) return '';

  return messages.map(msg => {
    const time = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
    return `[${time}] ${msg.user}: ${msg.text}`;
  }).join('\n');
}
