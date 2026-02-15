import { SearchResult } from './gmail';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export async function searchDrive(
  accessToken: string,
  accountId: string,
  query: string,
  maxResults: number = 20
): Promise<SearchResult[]> {
  const driveQuery = "fullText contains '" + query.replace(/'/g, "\'") + "'";
  const params = new URLSearchParams({
    q: driveQuery,
    pageSize: maxResults.toString(),
    fields: 'files(id,name,mimeType,description,webViewLink,modifiedTime,owners,size)',
    orderBy: 'modifiedTime desc',
  });

  const res = await fetch(
    DRIVE_API + '?' + params.toString(),
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const data = await res.json();
  if (!data.files || data.files.length === 0) return [];

  return data.files.map((file: Record<string, unknown>) => ({
    external_id: file.id as string,
    source: 'drive',
    source_account_id: accountId,
    title: (file.name as string) ?? 'Untitled',
    snippet: (file.description as string)?.slice(0, 200) ?? (file.mimeType as string) ?? '',
    url: (file.webViewLink as string) ?? '',
    occurred_at: (file.modifiedTime as string) ? new Date(file.modifiedTime as string).toISOString() : new Date().toISOString(),
    metadata: {
      mimeType: file.mimeType ?? '',
      size: file.size ?? null,
      owners: ((file.owners as Array<Record<string, string>>) ?? []).map(o => o.displayName ?? o.emailAddress),
    },
  }));
}
