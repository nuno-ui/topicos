import { google } from 'googleapis';
import { getGoogleClient } from './auth';
import type { NormalizedItem, ConnectorResult } from './types';

const DEFAULT_MAX_RESULTS = 50;

/**
 * Fetches Gmail messages and normalizes them into Item-compatible format.
 *
 * Uses pageToken-based pagination. Pass the cursor from a previous sync
 * to resume incrementally.
 */
export async function fetchGmailMessages(
  accessToken: string,
  refreshToken: string,
  cursor?: string,
  maxResults: number = DEFAULT_MAX_RESULTS
): Promise<ConnectorResult> {
  const auth = getGoogleClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  // List message IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRes: any = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken: cursor || undefined,
  });

  const messageRefs = listRes?.data?.messages ?? [];
  const nextCursor = listRes?.data?.nextPageToken ?? null;

  // Fetch metadata for each message
  const items: NormalizedItem[] = [];

  for (const ref of messageRefs) {
    if (!ref.id) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgRes: any = await gmail.users.messages.get({
        userId: 'me',
        id: ref.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To', 'Date'],
      });

      const msg = msgRes?.data;
      const headers = msg.payload?.headers ?? [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getHeader = (name: string): string =>
        headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? '';

      const subject = getHeader('Subject') || '(no subject)';
      const from = getHeader('From');
      const to = getHeader('To');
      const dateStr = getHeader('Date');
      const snippet = msg.snippet ?? null;

      // Parse the date, fallback to internalDate or now
      let occurredAt: string;
      if (dateStr) {
        const parsed = new Date(dateStr);
        occurredAt = isNaN(parsed.getTime())
          ? new Date(Number(msg.internalDate) || Date.now()).toISOString()
          : parsed.toISOString();
      } else {
        occurredAt = new Date(
          Number(msg.internalDate) || Date.now()
        ).toISOString();
      }

      const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${ref.id}`;

      items.push({
        external_id: ref.id,
        title: subject,
        snippet: snippet,
        body: null,
        url: gmailUrl,
        occurred_at: occurredAt,
        source: 'gmail',
        metadata: {
          from,
          to,
          labels: msg.labelIds ?? [],
          threadId: msg.threadId ?? null,
        },
      });
    } catch (err) {
      // Skip messages that fail to fetch (deleted, etc.)
      console.warn(`Failed to fetch Gmail message ${ref.id}:`, err);
    }
  }

  return { items, nextCursor };
}
