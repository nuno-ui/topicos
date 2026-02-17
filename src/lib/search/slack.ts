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
      replyCount: Math.max(0, messages.length - 1),
    };
  } catch (err) {
    console.error('Slack thread fetch error:', err);
    return { messages: [], replyCount: 0 };
  }
}

/**
 * Fetch surrounding channel messages for context around a specific message.
 * Gets messages before and after the target message to understand the conversation flow.
 * This is critical for non-threaded messages where context comes from surrounding chat.
 */
export async function getSlackChannelContext(
  accessToken: string,
  channelId: string,
  messageTs: string,
  windowSize: number = 8
): Promise<{ messages: Array<{ user: string; text: string; ts: string }>; contextType: 'channel' }> {
  try {
    // Fetch messages around the target timestamp
    // First, get messages BEFORE (including) the target
    const beforeRes = await fetch('https://slack.com/api/conversations.history', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        channel: channelId,
        latest: messageTs,
        limit: String(windowSize + 1), // +1 to include the target message itself
        inclusive: 'true',
      }),
    });

    const beforeData = await beforeRes.json();
    if (!beforeData.ok) {
      console.error('Slack channel history (before) error:', beforeData.error);
      return { messages: [], contextType: 'channel' };
    }

    // Then get messages AFTER the target
    const afterRes = await fetch('https://slack.com/api/conversations.history', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        channel: channelId,
        oldest: messageTs,
        limit: String(windowSize + 1),
        inclusive: 'false', // Don't include target again
      }),
    });

    const afterData = await afterRes.json();

    // Combine: before messages are in reverse chronological order, so reverse them
    const beforeMsgs = (beforeData.messages ?? []).reverse();
    const afterMsgs = afterData.ok ? (afterData.messages ?? []) : [];

    // Merge and deduplicate by ts
    const seenTs = new Set<string>();
    const allMessages: Array<{ user: string; text: string; ts: string }> = [];

    for (const msg of [...beforeMsgs, ...afterMsgs]) {
      const ts = (msg.ts as string) ?? '';
      if (ts && !seenTs.has(ts)) {
        seenTs.add(ts);
        allMessages.push({
          user: (msg.user as string) ?? (msg.username as string) ?? 'unknown',
          text: (msg.text as string) ?? '',
          ts,
        });
      }
    }

    // Sort chronologically
    allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    return { messages: allMessages, contextType: 'channel' };
  } catch (err) {
    console.error('Slack channel context fetch error:', err);
    return { messages: [], contextType: 'channel' };
  }
}

/**
 * Get full Slack message context — thread + surrounding channel messages.
 * For threaded messages: returns the full thread.
 * For non-threaded messages: returns surrounding channel context.
 * For all messages: also fetches nearby channel messages for broader context.
 */
export async function getSlackFullContext(
  accessToken: string,
  channelId: string,
  messageTs: string,
  threadTs?: string,
  replyCount?: number
): Promise<{
  thread: Array<{ user: string; text: string; ts: string }>;
  channelContext: Array<{ user: string; text: string; ts: string }>;
  hasThread: boolean;
  hasChannelContext: boolean;
}> {
  const results = {
    thread: [] as Array<{ user: string; text: string; ts: string }>,
    channelContext: [] as Array<{ user: string; text: string; ts: string }>,
    hasThread: false,
    hasChannelContext: false,
  };

  // Fetch thread if this message has replies or is part of a thread
  const effectiveThreadTs = threadTs || messageTs;
  const hasReplies = (replyCount ?? 0) > 0;
  const isInThread = threadTs && threadTs !== messageTs;

  if (hasReplies || isInThread) {
    const { messages } = await getSlackThread(accessToken, channelId, effectiveThreadTs);
    results.thread = messages;
    results.hasThread = messages.length > 1;
  }

  // ALWAYS fetch surrounding channel context for broader conversation understanding
  const { messages: channelMsgs } = await getSlackChannelContext(
    accessToken, channelId, messageTs, 6
  );
  results.channelContext = channelMsgs;
  results.hasChannelContext = channelMsgs.length > 1;

  return results;
}

/**
 * Format Slack context (thread + channel) into readable text for AI analysis.
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

/**
 * Format full Slack context with both thread and channel context sections.
 */
export function formatSlackFullContext(
  context: {
    thread: Array<{ user: string; text: string; ts: string }>;
    channelContext: Array<{ user: string; text: string; ts: string }>;
    hasThread: boolean;
    hasChannelContext: boolean;
  }
): string {
  const parts: string[] = [];

  if (context.hasThread && context.thread.length > 0) {
    parts.push('=== Thread Conversation ===');
    parts.push(formatSlackThread(context.thread));
  }

  if (context.hasChannelContext && context.channelContext.length > 0) {
    parts.push('=== Surrounding Channel Messages ===');
    parts.push(formatSlackThread(context.channelContext));
  }

  if (parts.length === 0) {
    return '';
  }

  return parts.join('\n\n');
}
