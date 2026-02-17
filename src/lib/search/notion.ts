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

// Fetch full page content (blocks) for deep content analysis
export async function getNotionPageContent(
  accessToken: string,
  pageId: string,
  maxBlocks: number = 500
): Promise<string> {
  try {
    const headers = {
      Authorization: 'Bearer ' + accessToken,
      'Notion-Version': '2022-06-28',
    };

    // Fetch blocks with pagination support
    let allBlocks: Record<string, unknown>[] = [];
    let cursor: string | undefined;

    while (allBlocks.length < maxBlocks) {
      const pageSize = Math.min(100, maxBlocks - allBlocks.length);
      let url = NOTION_API + '/blocks/' + pageId + '/children?page_size=' + pageSize;
      if (cursor) url += '&start_cursor=' + cursor;

      const res = await fetch(url, { headers });
      const data = await res.json();
      if (!data.results) break;

      allBlocks = allBlocks.concat(data.results);

      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }

    // Helper to extract text from a block at given indentation depth
    const extractBlockText = (block: Record<string, unknown>, depth: number = 0): string => {
      const type = block.type as string;
      const blockData = block[type] as Record<string, unknown> | undefined;
      if (!blockData) return '';

      const richTexts = blockData.rich_text as Array<{ plain_text: string }> | undefined;
      const text = richTexts ? richTexts.map(rt => rt.plain_text).join('') : '';
      const indent = '  '.repeat(depth);

      switch (type) {
        case 'paragraph': return text ? indent + text : '';
        case 'heading_1': return text ? '\n# ' + text : '';
        case 'heading_2': return text ? '\n## ' + text : '';
        case 'heading_3': return text ? '\n### ' + text : '';
        case 'bulleted_list_item': return text ? indent + '• ' + text : '';
        case 'numbered_list_item': return text ? indent + '- ' + text : '';
        case 'to_do': {
          const checked = (blockData.checked as boolean) ? '☑' : '☐';
          return text ? indent + checked + ' ' + text : '';
        }
        case 'toggle': return text ? indent + '▸ ' + text : '';
        case 'code': {
          const lang = (blockData.language as string) || '';
          return text ? indent + '```' + lang + '\n' + text + '\n```' : '';
        }
        case 'quote': return text ? indent + '> ' + text : '';
        case 'callout': {
          const icon = (blockData.icon as Record<string, string>)?.emoji || '💡';
          return text ? indent + icon + ' ' + text : '';
        }
        case 'divider': return '---';
        case 'table_row': {
          const cells = blockData.cells as Array<Array<{ plain_text: string }>> | undefined;
          if (cells) {
            const row = cells.map(cell => cell.map(c => c.plain_text).join('')).join(' | ');
            return indent + '| ' + row + ' |';
          }
          return '';
        }
        case 'bookmark': {
          const bookmarkUrl = (blockData.url as string) || '';
          return indent + '[Bookmark: ' + bookmarkUrl + ']' + (text ? ' ' + text : '');
        }
        case 'embed': {
          const embedUrl = (blockData.url as string) || '';
          return indent + '[Embed: ' + embedUrl + ']';
        }
        case 'image': case 'video': case 'file': case 'pdf': {
          const fileData = (blockData.file as Record<string, string>) || (blockData.external as Record<string, string>) || {};
          return indent + '[' + type + ': ' + (fileData.url || 'attached') + ']' + (text ? ' ' + text : '');
        }
        default: return text ? indent + text : '';
      }
    };

    // Fetch children of a block (for nested content like toggles, nested bullets)
    const fetchChildren = async (blockId: string, depth: number): Promise<string[]> => {
      if (depth > 3) return []; // Max nesting depth to avoid infinite recursion
      try {
        const childRes = await fetch(NOTION_API + '/blocks/' + blockId + '/children?page_size=100', { headers });
        const childData = await childRes.json();
        if (!childData.results) return [];
        const parts: string[] = [];
        for (const child of childData.results) {
          const line = extractBlockText(child, depth);
          if (line) parts.push(line);
          if (child.has_children) {
            const nested = await fetchChildren(child.id, depth + 1);
            parts.push(...nested);
          }
        }
        return parts;
      } catch {
        return [];
      }
    };

    const textParts: string[] = [];

    for (const block of allBlocks) {
      const line = extractBlockText(block, 0);
      if (line) textParts.push(line);
      // Fetch nested children (toggles, nested bullets, etc.)
      if (block.has_children) {
        const children = await fetchChildren(block.id as string, 1);
        textParts.push(...children);
      }
    }

    const fullContent = textParts.join('\n');

    // Truncate to 120,000 chars (large pages like 1:1 logs need full content for AI analysis)
    if (fullContent.length > 120000) {
      return fullContent.substring(0, 120000) + '\n\n[... content truncated at 120,000 characters]';
    }

    return fullContent;
  } catch (err) {
    console.error('Notion content fetch error:', err);
    return '';
  }
}
