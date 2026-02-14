import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user_id
  const error = searchParams.get('error');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  if (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, siteUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings?error=missing_params', siteUrl)
    );
  }

  const userId = state;

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Token exchange failed:', errBody);
      return NextResponse.redirect(
        new URL('/settings?error=token_exchange_failed', siteUrl)
      );
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokens;

    // Fetch user info from Google
    const userInfoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoRes.ok) {
      console.error('Failed to fetch user info');
      return NextResponse.redirect(
        new URL('/settings?error=userinfo_failed', siteUrl)
      );
    }

    const userInfo = await userInfoRes.json();
    const { email, id: providerAccountId } = userInfo;

    const tokenExpiresAt = new Date(
      Date.now() + (expires_in as number) * 1000
    ).toISOString();

    const scopes = typeof scope === 'string' ? scope.split(' ') : [];

    // Use service client to bypass RLS for the upsert
    const supabase = createServiceClient();

    // Check if this google account already exists for this user
    const { data: existing } = await supabase
      .from('google_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider_account_id', providerAccountId)
      .single();

    if (existing) {
      // Update existing account tokens
      await supabase
        .from('google_accounts')
        .update({
          access_token,
          refresh_token: refresh_token ?? undefined,
          token_expires_at: tokenExpiresAt,
          scopes,
          email,
        })
        .eq('id', existing.id);
    } else {
      // Insert new google account
      await supabase.from('google_accounts').insert({
        user_id: userId,
        email,
        provider_account_id: providerAccountId,
        access_token,
        refresh_token: refresh_token ?? '',
        token_expires_at: tokenExpiresAt,
        scopes,
      });
    }

    return NextResponse.redirect(new URL('/settings', siteUrl));
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(
      new URL('/settings?error=unexpected', siteUrl)
    );
  }
}
