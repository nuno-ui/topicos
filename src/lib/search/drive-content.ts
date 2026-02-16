/**
 * Google Drive content export — fetches actual document text for AI analysis.
 * Supports: Google Docs, Sheets, Slides, PDFs, and plain text files.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

/**
 * Export/download file content from Google Drive as plain text.
 * - Google Docs → export as text/plain
 * - Google Sheets → export as text/csv
 * - Google Slides → export as text/plain
 * - PDFs → export as text/plain (works for OCR'd PDFs)
 * - Other text files → download raw content
 */
export async function getDriveFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<{ content: string; exportedAs: string }> {
  const authHeader = { Authorization: 'Bearer ' + accessToken };

  try {
    // Google Workspace files need export endpoint
    const googleMimeMap: Record<string, { exportMime: string; label: string }> = {
      'application/vnd.google-apps.document': { exportMime: 'text/plain', label: 'Google Doc' },
      'application/vnd.google-apps.spreadsheet': { exportMime: 'text/csv', label: 'Google Sheet' },
      'application/vnd.google-apps.presentation': { exportMime: 'text/plain', label: 'Google Slides' },
      'application/vnd.google-apps.drawing': { exportMime: 'image/svg+xml', label: 'Google Drawing' },
    };

    let content = '';
    let exportedAs = mimeType;

    if (googleMimeMap[mimeType]) {
      // Export Google Workspace file
      const { exportMime, label } = googleMimeMap[mimeType];
      const url = `${DRIVE_API}/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
      const res = await fetch(url, { headers: authHeader });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Drive export error for ${label}:`, errText);
        return { content: `[Could not export ${label} content]`, exportedAs: 'error' };
      }

      content = await res.text();
      exportedAs = exportMime;
    } else if (mimeType === 'application/pdf') {
      // For PDFs, try to export as text (works for PDFs with text layer)
      // Note: This uses Drive's built-in OCR capability
      const url = `${DRIVE_API}/${fileId}/export?mimeType=text/plain`;
      const res = await fetch(url, { headers: authHeader });

      if (!res.ok) {
        // PDF export might fail — try downloading raw and note it's binary
        return { content: '[PDF file — content extraction requires OCR. File available in Google Drive.]', exportedAs: 'pdf-binary' };
      }

      content = await res.text();
      exportedAs = 'text/plain (from PDF)';
    } else if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/x-yaml' ||
      mimeType.includes('csv')
    ) {
      // Text-based files — download directly
      const url = `${DRIVE_API}/${fileId}?alt=media`;
      const res = await fetch(url, { headers: authHeader });

      if (!res.ok) {
        return { content: '[Could not download file content]', exportedAs: 'error' };
      }

      content = await res.text();
      exportedAs = mimeType;
    } else {
      // Binary files (images, videos, etc.) — can't extract text
      return {
        content: `[Binary file: ${mimeType}. Content not extractable as text.]`,
        exportedAs: 'binary'
      };
    }

    // Truncate to 15,000 chars to stay within AI token limits
    if (content.length > 15000) {
      content = content.substring(0, 15000) + '\n\n[... content truncated at 15,000 characters]';
    }

    return { content, exportedAs };
  } catch (err) {
    console.error('Drive content fetch error:', err);
    return { content: '[Error fetching file content]', exportedAs: 'error' };
  }
}
