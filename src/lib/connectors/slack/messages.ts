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
  maxResults: number = 50,
  _accountEmail?: string,
): Promise<ConnectorResult> {
  const items: NormalizedItem[] = [];

  // 1. List channels the bot/user is a member of
  const channelsRes = await slackGet('conversations.list', accessToken, {
    types: 'public_channel,private_channel,im,mpim',
    exclude_archived: 'true',
    limit: '100',
  });

  const channels: SlackChannel[] = channelsRes.channels ?? [];

  // 2. Build user cache for DM display names
  const userCache: Record<string, SlackUser> = {};

  // 3. Fetch recent messages from each channel
  const oldest = cursor ?? Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000).toString();

  for (const channel of channels) {
    if (!channel.is_member && !channel.is_im) continue;

    try {
      const historyRes = await slackGet('conversations.history', accessToken, {
        channel: channel.id,
        oldest,
        limit: Math.min(maxResults, 20).toString(),
      });

      const messages = historyRes.messages ?? [];

      for (const msg of messages) {
        if (!msg.text || msg.subtype === 'channel_join' || msg.subtype === 'channel_leave') continue;

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
        const title = `${userName} in #${channelName}`;
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
            is_dm: channel.is_im,
            ts: msg.ts,
          },
        });

        if (items.length >= maxResults) break;
      }
    } catch (err) {
      console.error(`Slack: failed to fetch channel ${channel.id}:`, err instanceof Error ? err.message : err);
    }

    if (items.length >= maxResults) break;
  }

  // Use the latest message timestamp as the cursor for next incremental sync
  const nextCursor = items.length > 0
    ? Math.max(...items.map(i => Math.floor(new Date(i.occurred_at).getTime() / 1000))).toString()
    : cursor ?? null;

  return { items, nextCursor };
}
