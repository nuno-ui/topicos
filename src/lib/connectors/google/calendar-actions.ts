import { google } from 'googleapis';
import { getGoogleClient } from './auth';

/**
 * Create a Google Calendar event.
 */
export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  options: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: { email: string }[];
  }
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: options.summary,
      description: options.description,
      location: options.location,
      start: options.start,
      end: options.end,
      attendees: options.attendees,
    },
  });

  return {
    eventId: res.data.id,
    htmlLink: res.data.htmlLink,
  };
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  options: {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime: string; timeZone?: string };
    end?: { dateTime: string; timeZone?: string };
    attendees?: { email: string }[];
  }
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      summary: options.summary,
      description: options.description,
      location: options.location,
      start: options.start,
      end: options.end,
      attendees: options.attendees,
    },
  });

  return {
    eventId: res.data.id,
    htmlLink: res.data.htmlLink,
  };
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });

  return { deleted: true };
}
