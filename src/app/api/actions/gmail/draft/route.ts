import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { createDraft } from '@/lib/connectors/google/gmail-actions';
import { refreshAccessToken } from '@/lib/connectors/google/auth';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { account_id, to, cc, subject, body_html, body_text, in_reply_to, thread_id, topic_id } = body;

  if (!account_id || !to || !subject) {
    return NextResponse.json({ error: 'account_id, to, and subject are required' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: account } = await serviceClient
    .from('google_accounts')
    .select('*')
    .eq('id', account_id)
    .eq('user_id', user.id)
    .single();

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  let accessToken = account.access_token;
  const tokenExpires = new Date(account.token_expires_at);

  if (tokenExpires.getTime() < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(account.refresh_token);
    accessToken = refreshed.accessToken;
    await serviceClient
      .from('google_accounts')
      .update({ access_token: accessToken, token_expires_at: refreshed.expiresAt })
      .eq('id', account_id);
  }

  try {
    const result = await createDraft(accessToken, account.refresh_token, {
      to: Array.isArray(to) ? to : [to],
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      subject,
      bodyHtml: body_html,
      bodyText: body_text,
      inReplyTo: in_reply_to,
      threadId: thread_id,
    });

    // Save to email_drafts
    await serviceClient.from('email_drafts').insert({
      user_id: user.id,
      account_id,
      topic_id: topic_id || null,
      to_addresses: Array.isArray(to) ? to : [to],
      cc_addresses: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
      subject,
      body_html,
      body_text,
      in_reply_to,
      status: 'draft',
      gmail_draft_id: result.draftId,
      agent_generated: false,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create draft' },
      { status: 500 }
    );
  }
}
