import { google } from 'googleapis';
import { getGoogleClient } from './auth';
import type { NormalizedItem, ConnectorResult } from './types';

const DEFAULT_MAX_RESULTS = 100;

/**
 * Fetches recent Google Drive files and normalizes them into Item-compatible format.
 *
 * Uses pageToken for pagination when cursor is provided.
 * Orders by modifiedTime descending to get the most recently changed files.
 */
export async function fetchDriveFiles(
  accessToken: string,
  refreshToken: string,
  cursor?: string,
  maxResults: number = DEFAULT_MAX_RESULTS
): Promise<ConnectorResult> {
  const auth = getGoogleClient(accessToken, refreshToken);
  const drive = google.drive({ version: 'v3', auth });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRes: any = await drive.files.list({
    pageSize: maxResults,
    pageToken: cursor || undefined,
    orderBy: 'modifiedTime desc',
    fields:
      'nextPageToken, files(id, name, mimeType, description, modifiedTime, webViewLink, size, owners, shared)',
    // Exclude trashed files
    q: 'trashed = false',
  });

  const files = listRes?.data?.files ?? [];
  const nextCursor = listRes?.data?.nextPageToken ?? null;

  const items: NormalizedItem[] = [];

  for (const file of files) {
    if (!file.id) continue;

    const occurredAt = file.modifiedTime
      ? new Date(file.modifiedTime).toISOString()
      : new Date().toISOString();

    // Use description if available, otherwise show the mimeType
    const snippet = file.description ?? file.mimeType ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const owners = (file.owners ?? []).map((o: any) => ({
      email: o.emailAddress,
      displayName: o.displayName,
    }));

    items.push({
      external_id: file.id,
      title: file.name ?? '(untitled)',
      snippet,
      body: null,
      url: file.webViewLink ?? null,
      occurred_at: occurredAt,
      source: 'drive',
      metadata: {
        mimeType: file.mimeType ?? null,
        size: file.size ?? null,
        owners,
        shared: file.shared ?? false,
      },
    });
  }

  return { items, nextCursor };
}
