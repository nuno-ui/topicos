import type { ConnectorResult, NormalizedItem } from '@/lib/connectors/google/types';
import type { SlackChannel, SlackUser } from './types';

const SLACK_API = 'https://slack.com/api';

async function slackGet(endpoint: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${SLACK_API}/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Slack API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API: ${data.error ?? 'unknown error'}`);
  }

  return data;
}

/**
 * Fetch recent messages from Slack channels and DMs.
 * Returns normalized items for the sync engine.
 */
export async function fetchSlackMessages(
  accessToken: string,
  _refreshToken: string,
  cursor?: string,
  maxResults: number = 200,
  _accountEmail?: string,
): Promise<ConnectorResult> {
  const items: NormalizedItem[] = [];

  // 1. List ALL channels — we need to paginate and explicitly check is_member
  let allChannels: SlackChannel[] = [];
  let nextPageCursor: string | undefined;

  do {
    const params: Record<string, string> = {
      types: 'public_channel,private_channel,im,mpim',
      exclude_archived: 'true',
      limit: '200',
    };
    if (nextPageCursor) {
      params.cursor = nextPageCursor;
    }

    const channelsRes = await slackGet('conversations.list', accessToken, params);
    const channels: SlackChannel[] = channelsRes.channels ?? [];
    allChannels = allChannels.concat(channels);

    nextPageCursor = channelsRes.response_metadata?.next_cursor;
  } while (nextPageCursor);

  // Filter to channels the bot is a member of (or DMs which are always accessible)
  const memberChannels = allChannels.filter(
    (ch) => ch.is_member || ch.is_im
  );

  console.log(
    `Slack: found ${allChannels.length} total channels, ${memberChannels.length} where bot is a member`
  );

  // If no channels, return early with helpful log
  if (memberChannels.length === 0) {
    console.log('Slack: bot is not a member of any channels. Invite the bot to channels to sync messages.');
    return { items: [], nextCursor: cursor ?? null };
  }

  // 2. Build user cache for display names
  const userCache: Record<string, SlackUser> = {};

  // 3. Fetch recent messages from each channel
  // For cursor-based incremental sync, use the cursor as "oldest" timestamp
  // For first sync, look back 30 days
  const oldest = cursor ?? Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000).toString();

  for (const channel of memberChannels) {
    try {
      const historyRes = await slackGet('conversations.history', accessToken, {
        channel: channel.id,
        oldest,
        limit: '50',
      });

      const messages = historyRes.messages ?? [];

      for (const msg of messages) {
        // Skip system/join/leave messages
        if (!msg.text || msg.subtype === 'channel_join' || msg.subtype === 'channel_leave'
            || msg.subtype === 'bot_add' || msg.subtype === 'bot_remove') continue;

        // Resolve user name
        let userName = msg.user ?? 'Unknown';
        if (msg.user && !userCache[msg.user]) {
          try {
            const userRes = await slackGet('users.info', accessToken, { user: msg.user });
            if (userRes.user) {
              userCache[msg.user] = userRes.user;
            }
          } catch {
            // Skip if user lookup fails
          }
        }
        const cachedUser = userCache[msg.user];
        if (cachedUser) {
          userName = cachedUser.profile?.real_name ?? cachedUser.real_name ?? cachedUser.name ?? msg.user;
        }

        // Determine channel display name
        let channelName = channel.name ?? channel.id;
        if (channel.is_im) {
          channelName = `DM: ${userName}`;
        }

        const timestamp = new Date(parseFloat(msg.ts) * 1000);
        const title = channel.is_im
          ? `DM from ${userName}`
          : `${userName} in #${channelName}`;
        const snippet = msg.text.slice(0, 300);

        items.push({
          external_id: `slack-${channel.id}-${msg.ts}`,
          title,
          snippet,
          body: msg.text,
          url: null,
          occurred_at: timestamp.toISOString(),
          source: 'slack',
          metadata: {
            channel_id: channel.id,
            channel_name: channelName,
            user_id: msg.user,
            user_name: userName,
            user_email: cachedUser?.profile?.email ?? null,
            thread_ts: msg.thread_ts ?? null,
            is_dm: channel.is_im ?? false,
            ts: msg.ts,
          },
        });

        if (items.length >= maxResults) break;
      }
    } catch (err) {
      console.error(`Slack: failed to fetch channel ${channel.name ?? channel.id}:`, err instanceof Error ? err.message : err);
    }

    if (items.length >= maxResults) break;
  }

  console.log(`Slack: fetched ${items.length} messages from ${memberChannels.length} channels`);

  // Use the latest message timestamp as the cursor for next incremental sync
  const nextCursor = items.length > 0
    ? Math.max(...items.map(i => Math.floor(new Date(i.occurred_at).getTime() / 1000))).toString()
    : cursor ?? null;

  return { items, nextCursor };
}
