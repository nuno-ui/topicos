import { google } from 'googleapis';
import { getGoogleClient } from './auth';
import type { NormalizedItem, ConnectorResult } from './types';

const DEFAULT_MAX_RESULTS = 100;

/**
 * Fetches Google Calendar events and normalizes them into Item-compatible format.
 *
 * Uses syncToken for incremental sync when cursor is provided.
 * On initial sync (no cursor), fetches events from the last 30 days.
 */
export async function fetchCalendarEvents(
  accessToken: string,
  refreshToken: string,
  cursor?: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
  accountEmail?: string
): Promise<ConnectorResult> {
  const auth = getGoogleClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  // Build request params
  const params: Record<string, unknown> = {
    calendarId: 'primary',
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  };

  if (cursor) {
    // Incremental sync using syncToken
    params.syncToken = cursor;
  } else {
    // Initial sync: last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    params.timeMin = thirtyDaysAgo.toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listRes: any;
  try {
    listRes = await calendar.events.list(
      params as unknown as Parameters<typeof calendar.events.list>[0]
    );
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 410
    ) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      listRes = await calendar.events.list({
        calendarId: 'primary',
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: thirtyDaysAgo.toISOString(),
      });
    } else {
      throw err;
    }
  }

  const events = listRes?.data?.items ?? [];
  const nextCursor = listRes?.data?.nextSyncToken ?? listRes?.data?.nextPageToken ?? null;

  const items: NormalizedItem[] = [];

  for (const event of events) {
    if (!event.id) continue;

    // Determine start time
    const startTime =
      event.start?.dateTime ?? event.start?.date ?? null;
    const occurredAt = startTime
      ? new Date(startTime).toISOString()
      : new Date().toISOString();

    // Build snippet from description (first 200 chars)
    const snippet = event.description
      ? event.description.substring(0, 200)
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attendees = (event.attendees ?? []).map((a: any) => ({
      email: a.email,
      responseStatus: a.responseStatus,
      organizer: a.organizer ?? false,
    }));

    items.push({
      external_id: event.id,
      title: event.summary ?? '(no title)',
      snippet,
      body: null,
      url: event.htmlLink
        ? (accountEmail && !event.htmlLink.includes('authuser')
          ? `${event.htmlLink}${event.htmlLink.includes('?') ? '&' : '?'}authuser=${encodeURIComponent(accountEmail)}`
          : event.htmlLink)
        : null,
      occurred_at: occurredAt,
      source: 'calendar',
      metadata: {
        location: event.location ?? null,
        attendees,
        status: event.status ?? null,
        organizer: event.organizer
          ? { email: event.organizer.email, displayName: event.organizer.displayName }
          : null,
        start: event.start ?? null,
        end: event.end ?? null,
        recurringEventId: event.recurringEventId ?? null,
        recurrence: event.recurrence ?? null,
      },
    });
  }

  return { items, nextCursor };
}
