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
  const url = GMAIL_API + '?q=' + encodeURIComponent(query) + '&maxResults=' + maxResults;
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
        url: 'https://mail.google.com/mail/#inbox/' + msg.id,
        occurred_at: gh('Date') ? new Date(gh('Date')).toISOString() : new Date(parseInt(msg.internalDate)).toISOString(),
        metadata: { from: gh('From'), to: gh('To'), labels: msg.labelIds ?? [], threadId: msg.threadId },
      });
    }
  }
  return results;
}
