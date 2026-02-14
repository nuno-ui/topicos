import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // user_id
  const errorParam = url.searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (errorParam) {
    return NextResponse.redirect(`${appUrl}/settings?error=slack_${errorParam}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?error=slack_missing_params`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/settings?error=slack_not_configured`);
  }

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/auth/slack/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      console.error('Slack token exchange failed:', tokenData.error);
      return NextResponse.redirect(`${appUrl}/settings?error=slack_token_${tokenData.error}`);
    }

    const accessToken = tokenData.access_token;
    const teamId = tokenData.team?.id ?? '';
    const teamName = tokenData.team?.name ?? '';
    const botUserId = tokenData.bot_user_id ?? null;
    const scopes = (tokenData.scope ?? '').split(',');
    const userId = state;

    // Upsert into slack_accounts
    const supabase = createServiceClient();
    const { error: upsertError } = await supabase
      .from('slack_accounts')
      .upsert(
        {
          user_id: userId,
          team_id: teamId,
          team_name: teamName,
          bot_user_id: botUserId,
          access_token: accessToken,
          scopes,
        },
        { onConflict: 'user_id,team_id' },
      );

    if (upsertError) {
      console.error('Failed to save Slack account:', upsertError.message);
      return NextResponse.redirect(`${appUrl}/settings?error=slack_save_failed`);
    }

    return NextResponse.redirect(`${appUrl}/settings?success=slack_connected`);
  } catch (err) {
    console.error('Slack OAuth error:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(`${appUrl}/settings?error=slack_unknown`);
  }
}
