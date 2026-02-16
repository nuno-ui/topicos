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
  maxBlocks: number = 100
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

    const textParts: string[] = [];

    for (const block of allBlocks) {
      const type = block.type as string;
      const blockData = block[type] as Record<string, unknown> | undefined;
      if (!blockData) continue;

      // Extract rich text content
      const richTexts = blockData.rich_text as Array<{ plain_text: string }> | undefined;
      const text = richTexts ? richTexts.map(rt => rt.plain_text).join('') : '';

      switch (type) {
        case 'paragraph':
          if (text) textParts.push(text);
          break;
        case 'heading_1':
          if (text) textParts.push('\n# ' + text);
          break;
        case 'heading_2':
          if (text) textParts.push('\n## ' + text);
          break;
        case 'heading_3':
          if (text) textParts.push('\n### ' + text);
          break;
        case 'bulleted_list_item':
          if (text) textParts.push('• ' + text);
          break;
        case 'numbered_list_item':
          if (text) textParts.push('- ' + text);
          break;
        case 'to_do': {
          const checked = (blockData.checked as boolean) ? '☑' : '☐';
          if (text) textParts.push(checked + ' ' + text);
          break;
        }
        case 'toggle':
          if (text) textParts.push('▸ ' + text);
          break;
        case 'code': {
          const lang = (blockData.language as string) || '';
          if (text) textParts.push('```' + lang + '\n' + text + '\n```');
          break;
        }
        case 'quote':
          if (text) textParts.push('> ' + text);
          break;
        case 'callout': {
          const icon = (blockData.icon as Record<string, string>)?.emoji || '💡';
          if (text) textParts.push(icon + ' ' + text);
          break;
        }
        case 'divider':
          textParts.push('---');
          break;
        case 'table_row': {
          const cells = blockData.cells as Array<Array<{ plain_text: string }>> | undefined;
          if (cells) {
            const row = cells.map(cell => cell.map(c => c.plain_text).join('')).join(' | ');
            textParts.push('| ' + row + ' |');
          }
          break;
        }
        case 'bookmark': {
          const bookmarkUrl = (blockData.url as string) || '';
          textParts.push('[Bookmark: ' + bookmarkUrl + ']' + (text ? ' ' + text : ''));
          break;
        }
        case 'embed': {
          const embedUrl = (blockData.url as string) || '';
          textParts.push('[Embed: ' + embedUrl + ']');
          break;
        }
        case 'image':
        case 'video':
        case 'file':
        case 'pdf': {
          const fileData = (blockData.file as Record<string, string>) || (blockData.external as Record<string, string>) || {};
          textParts.push('[' + type + ': ' + (fileData.url || 'attached') + ']' + (text ? ' ' + text : ''));
          break;
        }
        default:
          // For any other block type with text
          if (text) textParts.push(text);
          break;
      }
    }

    const fullContent = textParts.join('\n');

    // Truncate to 15,000 chars for AI token limits
    if (fullContent.length > 15000) {
      return fullContent.substring(0, 15000) + '\n\n[... content truncated at 15,000 characters]';
    }

    return fullContent;
  } catch (err) {
    console.error('Notion content fetch error:', err);
    return '';
  }
}
