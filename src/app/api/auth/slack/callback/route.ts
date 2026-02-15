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

    const service = createServiceClient();
    await service.from('slack_accounts').upsert({
      user_id: user.id,
      team_id: tokenData.team?.id ?? '',
      team_name: tokenData.team?.name ?? '',
      access_token: tokenData.access_token,
      scope: tokenData.scope ?? '',
    }, { onConflict: 'user_id, team_id' });

    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/settings?success=slack_connected');
  } catch (err) {
    console.error('Slack callback error:', err);
    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/settings?error=slack_failed');
  }
}
