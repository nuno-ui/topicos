import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/settings?error=no_code');

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/login');

    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        redirect_uri: process.env.NEXT_PUBLIC_APP_URL! + '/api/auth/slack/callback',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.ok) throw new Error(tokenData.error || 'Slack OAuth failed');

    // CRITICAL: User tokens are in authed_user, NOT at the top level
    // tokenData.access_token = bot token (xoxb-...)
    // tokenData.authed_user.access_token = user token (xoxp-...)
    const userToken = tokenData.authed_user?.access_token;
    const userScopes = tokenData.authed_user?.scope || '';

    if (!userToken) {
      console.error('No user token received. Full response:', JSON.stringify(tokenData));
      throw new Error('No user token received from Slack. Make sure user_scope is set.');
    }

    const service = createServiceClient();
    const { error: upsertError } = await service.from('slack_accounts').upsert({
      user_id: user.id,
      team_id: tokenData.team?.id ?? '',
      team_name: tokenData.team?.name ?? '',
      access_token: userToken,
      scopes: userScopes.split(',').filter(Boolean),
    }, { onConflict: 'user_id, team_id' });
    if (upsertError) {
      console.error('Slack upsert error:', upsertError);
      throw new Error('Failed to save Slack account: ' + upsertError.message);
    }

    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/settings?success=slack_connected');
  } catch (err) {
    console.error('Slack callback error:', err);
    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/settings?error=slack_failed');
  }
}
