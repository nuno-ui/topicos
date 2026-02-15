import { SearchResult } from './gmail';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export async function searchCalendar(
  accessToken: string,
  accountId: string,
  query: string,
  maxResults: number = 20,
  dateFrom?: string,
  dateTo?: string
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (dateFrom) params.set('timeMin', new Date(dateFrom).toISOString());
  else params.set('timeMin', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  if (dateTo) params.set('timeMax', new Date(dateTo).toISOString());
  else params.set('timeMax', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());

  const res = await fetch(
    CALENDAR_API + '?' + params.toString(),
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const data = await res.json();
  if (!data.items || data.items.length === 0) return [];

  return data.items.map((event: Record<string, unknown>) => {
    const start = (event.start as Record<string, string>)?.dateTime ?? (event.start as Record<string, string>)?.date ?? '';
    const end = (event.end as Record<string, string>)?.dateTime ?? (event.end as Record<string, string>)?.date ?? '';
    const attendees = ((event.attendees as Array<Record<string, string>>) ?? []).map(a => a.email).filter(Boolean);

    return {
      external_id: event.id as string,
      source: 'calendar',
      source_account_id: accountId,
      title: (event.summary as string) ?? '(No title)',
      snippet: ((event.description as string) ?? '').slice(0, 200),
      url: (event.htmlLink as string) ?? '',
      occurred_at: start ? new Date(start).toISOString() : new Date().toISOString(),
      metadata: {
        start,
        end,
        location: event.location ?? '',
        attendees,
        status: event.status ?? '',
        organizer: (event.organizer as Record<string, string>)?.email ?? '',
      },
    };
  });
}
