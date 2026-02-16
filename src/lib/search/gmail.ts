export interface SearchResult {
  external_id: string;
  source: string;
  source_account_id: string;
  title: string;
  snippet: string;
  url: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

export async function searchGmail(
  accessToken: string,
  accountId: string,
  query: string,
  maxResults: number = 20
): Promise<SearchResult[]> {
  // Search across ALL labels (inbox, sent, drafts, etc.) — no labelIds filter
  const url = GMAIL_API + '?q=' + encodeURIComponent(query) + '&maxResults=' + maxResults + '&includeSpamTrash=false';
  const authHeader = { Authorization: 'Bearer ' + accessToken };
  const listRes = await fetch(url, { headers: authHeader });
  const listData = await listRes.json();
  if (!listData.messages || listData.messages.length === 0) return [];
  const results: SearchResult[] = [];
  const messageIds = listData.messages.map((m: { id: string }) => m.id);
  for (let i = 0; i < messageIds.length; i += 10) {
    const batch = messageIds.slice(i, i + 10);
    const fetches = batch.map(async (msgId: string) => {
      const msgUrl = GMAIL_API + '/' + msgId + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date';
      const msgRes = await fetch(msgUrl, { headers: authHeader });
      return msgRes.json();
    });
    const messages = await Promise.all(fetches);
    for (const msg of messages) {
      if (!msg.id) continue;
      const hdrs = msg.payload?.headers ?? [];
      const gh = (n: string) => hdrs.find(
        (h: {name: string; value: string}) => h.name.toLowerCase() === n.toLowerCase()
      )?.value ?? '';
      results.push({
        external_id: msg.id,
        source: 'gmail',
        source_account_id: accountId,
        title: gh('Subject') || '(No subject)',
        snippet: msg.snippet ?? '',
        url: 'https://mail.google.com/mail/#all/' + msg.id,
        occurred_at: gh('Date') ? new Date(gh('Date')).toISOString() : new Date(parseInt(msg.internalDate)).toISOString(),
        metadata: {
          from: gh('From'),
          to: gh('To'),
          labels: msg.labelIds ?? [],
          threadId: msg.threadId,
          is_sent: (msg.labelIds ?? []).includes('SENT'),
        },
      });
    }
  }
  return results;
}

/**
 * Fetch full email body text for a specific message.
 * Uses format=full to get the complete MIME payload, then extracts text/plain or text/html content.
 */
export async function getGmailMessageBody(
  accessToken: string,
  messageId: string
): Promise<{ body: string; attachments: string[]; cc: string; bcc: string }> {
  const url = GMAIL_API + '/' + messageId + '?format=full';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  const msg = await res.json();
  if (!msg.payload) return { body: '', attachments: [], cc: '', bcc: '' };

  // Extract CC/BCC headers
  const headers = msg.payload.headers ?? [];
  const getHeader = (name: string) => headers.find(
    (h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase()
  )?.value ?? '';

  const cc = getHeader('Cc');
  const bcc = getHeader('Bcc');

  // Extract attachments
  const attachments: string[] = [];
  const extractAttachments = (part: Record<string, unknown>) => {
    if (part.filename && (part.filename as string).length > 0) {
      attachments.push(part.filename as string);
    }
    if (part.parts) {
      for (const p of part.parts as Record<string, unknown>[]) {
        extractAttachments(p);
      }
    }
  };
  extractAttachments(msg.payload);

  // Extract body text
  let bodyText = '';
  const extractText = (part: Record<string, unknown>): string => {
    const mimeType = part.mimeType as string;

    // If this part has sub-parts, recurse
    if (part.parts) {
      const parts = part.parts as Record<string, unknown>[];
      // Prefer text/plain over text/html
      const plainPart = parts.find(p => (p.mimeType as string) === 'text/plain');
      if (plainPart) return extractText(plainPart);
      const htmlPart = parts.find(p => (p.mimeType as string) === 'text/html');
      if (htmlPart) return extractText(htmlPart);
      // Try first alternative/related/mixed part
      for (const p of parts) {
        const result = extractText(p);
        if (result) return result;
      }
      return '';
    }

    // Leaf part — decode body data
    const bodyData = (part.body as Record<string, unknown>)?.data as string;
    if (!bodyData) return '';

    // Base64url decode
    const decoded = Buffer.from(bodyData.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');

    if (mimeType === 'text/plain') {
      return decoded;
    } else if (mimeType === 'text/html') {
      // Strip HTML tags for clean text
      return decoded
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    return '';
  };

  bodyText = extractText(msg.payload);

  // Truncate to 10,000 chars to stay within AI token limits
  if (bodyText.length > 10000) {
    bodyText = bodyText.substring(0, 10000) + '\n\n[... content truncated at 10,000 characters]';
  }

  return { body: bodyText, attachments, cc, bcc };
}
