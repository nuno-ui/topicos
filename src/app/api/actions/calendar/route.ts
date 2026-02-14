import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/connectors/google/calendar-actions';
import { refreshAccessToken } from '@/lib/connectors/google/auth';

async function getAccountTokens(userId: string, accountId: string) {
  const serviceClient = createServiceClient();
  const { data: account } = await serviceClient
    .from('google_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (!account) throw new Error('Account not found');

  let accessToken = account.access_token;
  const tokenExpires = new Date(account.token_expires_at);

  if (tokenExpires.getTime() < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(account.refresh_token);
    accessToken = refreshed.accessToken;
    await serviceClient
      .from('google_accounts')
      .update({ access_token: accessToken, token_expires_at: refreshed.expiresAt })
      .eq('id', accountId);
  }

  return { accessToken, refreshToken: account.refresh_token };
}

// POST /api/actions/calendar - Create event
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { account_id, summary, description, location, start, end, attendees } = body;

  if (!account_id || !summary || !start || !end) {
    return NextResponse.json({ error: 'account_id, summary, start, and end are required' }, { status: 400 });
  }

  try {
    const tokens = await getAccountTokens(user.id, account_id);
    const result = await createCalendarEvent(tokens.accessToken, tokens.refreshToken, {
      summary,
      description,
      location,
      start,
      end,
      attendees,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}

// PATCH /api/actions/calendar - Update event
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { account_id, event_id, ...updates } = body;

  if (!account_id || !event_id) {
    return NextResponse.json({ error: 'account_id and event_id are required' }, { status: 400 });
  }

  try {
    const tokens = await getAccountTokens(user.id, account_id);
    const result = await updateCalendarEvent(tokens.accessToken, tokens.refreshToken, event_id, updates);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update event' },
      { status: 500 }
    );
  }
}

// DELETE /api/actions/calendar - Delete event
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { account_id, event_id } = body;

  if (!account_id || !event_id) {
    return NextResponse.json({ error: 'account_id and event_id are required' }, { status: 400 });
  }

  try {
    const tokens = await getAccountTokens(user.id, account_id);
    const result = await deleteCalendarEvent(tokens.accessToken, tokens.refreshToken, event_id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete event' },
      { status: 500 }
    );
  }
}
