import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID!;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL! + '/api/auth/slack/callback';

  // CRITICAL: Use user_scope (NOT scope) to get a user token (xoxp-...)
  // scope= gives bot tokens (xoxb-...) which can't use search.messages
  const userScopes = [
    'channels:history', 'channels:read',
    'groups:history', 'groups:read',
    'im:history', 'im:read',
    'mpim:history', 'mpim:read',
    'search:read',
    'team:read',
    'users:read', 'users:read.email',
  ].join(',');

  const params = new URLSearchParams({
    client_id: clientId,
    user_scope: userScopes,
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(
    'https://slack.com/oauth/v2/authorize?' + params.toString()
  );
}
