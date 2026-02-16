/**
 * Fetches content from external URLs for AI analysis
 */
export async function fetchLinkContent(url: string, maxLength: number = 15000): Promise<{
  title: string;
  description: string;
  body: string;
  contentType: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TopicOS/1.0 (Content Analyzer)',
        'Accept': 'text/html, application/json, text/plain',
      },
    });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (contentType.includes('text/html')) {
      // Extract title
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : url;

      // Extract meta description
      const descMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
      const description = descMatch ? descMatch[1].trim() : '';

      // Strip HTML tags for body text
      let body = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      if (body.length > maxLength) {
        body = body.substring(0, maxLength) + '\n[Content truncated]';
      }

      return { title, description, body, contentType: 'html' };
    } else if (contentType.includes('application/json')) {
      const body = text.substring(0, maxLength);
      return { title: url, description: 'JSON data', body, contentType: 'json' };
    } else {
      const body = text.substring(0, maxLength);
      return { title: url, description: 'Text content', body, contentType: 'text' };
    }
  } catch (err) {
    return {
      title: url,
      description: err instanceof Error ? err.message : 'Failed to fetch',
      body: '',
      contentType: 'error',
    };
  }
}
