import { createServiceClient } from '@/lib/supabase/server';

export async function getValidGoogleToken(accountId: string) {
  const supabase = createServiceClient();
  const { data: account, error } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('id', accountId)
    .single();
  if (error || !account) throw new Error('Google account not found');

  const expiresAt = new Date(account.token_expires_at);
  if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
    // Token expiring within 5 min -- refresh it
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await res.json();
    if (tokenData.error) throw new Error(`Token refresh failed: ${tokenData.error}`);

    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();
    await supabase.from('google_accounts').update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
    }).eq('id', accountId);

    return { accessToken: tokenData.access_token as string, email: account.email as string, accountId };
  }
  return { accessToken: account.access_token as string, email: account.email as string, accountId };
}
