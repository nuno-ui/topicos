import { getValidGoogleToken } from '@/lib/auth/google-tokens';
import { searchGmail, type SearchResult } from './gmail';
import { searchCalendar } from './calendar';
import { searchDrive } from './drive';
import { searchSlack } from './slack';
import { createServiceClient } from '@/lib/supabase/server';

export type { SearchResult };

export interface SearchRequest {
  query: string;
  sources: string[];
  topic_id?: string;
  date_from?: string;
  date_to?: string;
  max_results?: number;
}

export interface SourceSearchResult {
  source: string;
  items: SearchResult[];
  error?: string;
}

export async function searchAllSources(userId: string, request: SearchRequest): Promise<SourceSearchResult[]> {
  const supabase = createServiceClient();
  const maxResults = request.max_results ?? 20;
  const results: SourceSearchResult[] = [];

  const [googleRes, slackRes] = await Promise.all([
    supabase.from('google_accounts').select('id').eq('user_id', userId),
    supabase.from('slack_accounts').select('id, access_token').eq('user_id', userId),
  ]);
  const googleAccounts = googleRes.data ?? [];
  const slackAccounts = slackRes.data ?? [];

  let linkedIds = new Set<string>();
  if (request.topic_id) {
    const { data: links } = await supabase
      .from('topic_items')
      .select('external_id, source')
      .eq('topic_id', request.topic_id);
    if (links) {
      linkedIds = new Set(links.map(l => l.source + ':' + l.external_id));
    }
  }

  // Search Google sources in parallel
  const googleSources = request.sources.filter(s => ['gmail', 'calendar', 'drive'].includes(s));
  if (googleSources.length > 0 && googleAccounts.length > 0) {
    for (const account of googleAccounts) {
      try {
        const { accessToken, accountId } = await getValidGoogleToken(account.id);
        const searches = googleSources.map(async (source) => {
          try {
            let items: SearchResult[] = [];
            switch (source) {
              case 'gmail':
                items = await searchGmail(accessToken, accountId, request.query, maxResults);
                break;
              case 'calendar':
                items = await searchCalendar(accessToken, accountId, request.query, maxResults, request.date_from, request.date_to);
                break;
              case 'drive':
                items = await searchDrive(accessToken, accountId, request.query, maxResults);
                break;
            }
            return { source, items, error: undefined };
          } catch (err) {
            return { source, items: [], error: err instanceof Error ? err.message : 'Search failed' };
          }
        });
        const searchResults = await Promise.all(searches);
        results.push(...searchResults);
      } catch (err) {
        googleSources.forEach(source => {
          results.push({ source, items: [], error: err instanceof Error ? err.message : 'Token error' });
        });
      }
    }
  }

  // Search Slack
  if (request.sources.includes('slack') && slackAccounts.length > 0) {
    for (const account of slackAccounts) {
      try {
        const items = await searchSlack(account.access_token, account.id, request.query, maxResults);
        results.push({ source: 'slack', items });
      } catch (err) {
        results.push({ source: 'slack', items: [], error: err instanceof Error ? err.message : 'Slack search failed' });
      }
    }
  }

  // Mark already-linked items
  for (const result of results) {
    for (const item of result.items) {
      (item as SearchResult & { already_linked?: boolean }).already_linked = linkedIds.has(item.source + ':' + item.external_id);
    }
  }

  return results;
}
