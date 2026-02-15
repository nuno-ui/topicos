import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID!;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL! + '/api/auth/slack/callback';
  const scopes = 'search:read,users:read';

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(
    'https://slack.com/oauth/v2/authorize?' + params.toString()
  );
}
