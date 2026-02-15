import { SearchResult } from './gmail';

const NOTION_API = 'https://api.notion.com/v1';

export async function searchNotion(
  accessToken: string,
  accountId: string,
  query: string,
  maxResults: number = 20
): Promise<SearchResult[]> {
  const res = await fetch(NOTION_API + '/search', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      query,
      page_size: Math.min(maxResults, 100),
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
    }),
  });

  const data = await res.json();
  if (data.status && data.status !== 200) {
    console.error('Notion search error:', data);
    throw new Error('Notion search failed: ' + (data.message || data.code || 'Unknown error'));
  }

  const results: SearchResult[] = [];
  for (const result of data.results ?? []) {
    const id = result.id;
    const objectType = result.object; // 'page' or 'database'
    const url = result.url || '';
    const lastEdited = result.last_edited_time || new Date().toISOString();
    const createdTime = result.created_time || lastEdited;

    let title = '';
    let snippet = '';

    if (objectType === 'page') {
      // Extract title from page properties
      const properties = result.properties || {};
      for (const [, prop] of Object.entries(properties)) {
        const p = prop as Record<string, unknown>;
        if (p.type === 'title') {
          const titleArray = p.title as Array<{ plain_text: string }>;
          if (titleArray && titleArray.length > 0) {
            title = titleArray.map(t => t.plain_text).join('');
          }
          break;
        }
      }
      // Use parent info for snippet context
      if (result.parent) {
        if (result.parent.type === 'database_id') {
          snippet = 'Page in database';
        } else if (result.parent.type === 'workspace') {
          snippet = 'Top-level page';
        } else if (result.parent.type === 'page_id') {
          snippet = 'Subpage';
        }
      }

      // Try to get icon info
      if (result.icon) {
        if (result.icon.type === 'emoji') {
          title = result.icon.emoji + ' ' + title;
        }
      }
    } else if (objectType === 'database') {
      // Extract database title
      const titleArray = result.title as Array<{ plain_text: string }> | undefined;
      if (titleArray && titleArray.length > 0) {
        title = titleArray.map(t => t.plain_text).join('');
      }
      snippet = 'Database';

      if (result.icon) {
        if (result.icon.type === 'emoji') {
          title = result.icon.emoji + ' ' + title;
        }
      }
    }

    if (!title) title = 'Untitled ' + objectType;

    // Add cover/icon metadata
    const metadata: Record<string, unknown> = {
      object_type: objectType,
      created_time: createdTime,
      last_edited_by: result.last_edited_by?.id || null,
      created_by: result.created_by?.id || null,
      parent_type: result.parent?.type || null,
      archived: result.archived || false,
    };

    results.push({
      external_id: id,
      source: 'notion',
      source_account_id: accountId,
      title,
      snippet,
      url,
      occurred_at: lastEdited,
      metadata,
    });
  }

  return results;
}

// Fetch page content (blocks) for richer snippets
export async function getNotionPageContent(
  accessToken: string,
  pageId: string,
  maxBlocks: number = 20
): Promise<string> {
  try {
    const res = await fetch(NOTION_API + '/blocks/' + pageId + '/children?page_size=' + maxBlocks, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Notion-Version': '2022-06-28',
      },
    });

    const data = await res.json();
    if (!data.results) return '';

    const textParts: string[] = [];
    for (const block of data.results) {
      const richTexts = block[block.type]?.rich_text as Array<{ plain_text: string }> | undefined;
      if (richTexts) {
        const text = richTexts.map(rt => rt.plain_text).join('');
        if (text) textParts.push(text);
      }
    }

    return textParts.join('\n').slice(0, 500);
  } catch {
    return '';
  }
}
