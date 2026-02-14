import { google } from 'googleapis';
import { getGoogleClient } from './auth';
import type { NormalizedItem, ConnectorResult } from './types';

const DEFAULT_MAX_RESULTS = 50;

/**
 * Decode base64url-encoded string to UTF-8 text.
 */
function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Recursively extract the text body from a Gmail MIME payload.
 * Prefers text/plain, falls back to text/html (stripped of tags).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any, maxLength = 2000): string | null {
  if (!payload) return null;

  // Single-part message
  if (payload.body?.data && payload.mimeType === 'text/plain') {
    return decodeBase64Url(payload.body.data).slice(0, maxLength);
  }

  // Multipart — recurse into parts
  if (payload.parts && Array.isArray(payload.parts)) {
    // First pass: look for text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data).slice(0, maxLength);
      }
    }
    // Second pass: look for text/html, strip tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return text.slice(0, maxLength);
      }
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part, maxLength);
      if (nested) return nested;
    }
  }

  // Fallback: body.data on root (plain single-part)
  if (payload.body?.data) {
    if (payload.mimeType === 'text/html') {
      const html = decodeBase64Url(payload.body.data);
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return text.slice(0, maxLength);
    }
    return decodeBase64Url(payload.body.data).slice(0, maxLength);
  }

  return null;
}

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
  maxResults: number = DEFAULT_MAX_RESULTS,
  accountEmail?: string
): Promise<ConnectorResult> {
  const auth = getGoogleClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  // List message IDs (inbox + sent)
  // Fetch both received and sent messages by not filtering by label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRes: any = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken: cursor || undefined,
    q: 'in:inbox OR in:sent',
  });

  const messageRefs = listRes?.data?.messages ?? [];
  const nextCursor = listRes?.data?.nextPageToken ?? null;

  // Fetch full content for each message
  const items: NormalizedItem[] = [];

  for (const ref of messageRefs) {
    if (!ref.id) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgRes: any = await gmail.users.messages.get({
        userId: 'me',
        id: ref.id,
        format: 'full',
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

      // Extract message body from MIME payload
      const body = extractBody(msg.payload);

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

      const gmailUrl = accountEmail
        ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}#inbox/${ref.id}`
        : `https://mail.google.com/mail/u/0/#inbox/${ref.id}`;

      // Determine if sent or received based on labels
      const labels: string[] = msg.labelIds ?? [];
      const isSent = labels.includes('SENT');

      items.push({
        external_id: ref.id,
        title: subject,
        snippet: snippet,
        body: body,
        url: gmailUrl,
        occurred_at: occurredAt,
        source: 'gmail',
        metadata: {
          from,
          to,
          labels,
          threadId: msg.threadId ?? null,
          direction: isSent ? 'sent' : 'received',
        },
      });
    } catch (err) {
      // Skip messages that fail to fetch (deleted, etc.)
      console.warn(`Failed to fetch Gmail message ${ref.id}:`, err);
    }
  }

  return { items, nextCursor };
}
