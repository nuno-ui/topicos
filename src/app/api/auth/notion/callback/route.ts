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

    // Exchange code for access token
    // Notion uses Basic Auth: base64(client_id:client_secret)
    const credentials = Buffer.from(
      process.env.NOTION_CLIENT_ID! + ':' + process.env.NOTION_CLIENT_SECRET!
    ).toString('base64');

    const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + credentials,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.NEXT_PUBLIC_APP_URL! + '/api/auth/notion/callback',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error('Notion token error:', tokenData);
      throw new Error(tokenData.error || 'Notion OAuth failed');
    }

    // tokenData shape:
    // {
    //   access_token: "ntn_...",
    //   token_type: "bearer",
    //   bot_id: "...",
    //   workspace_id: "...",
    //   workspace_name: "...",
    //   workspace_icon: "...",
    //   owner: { type: "user", user: { id: "...", ... } },
    //   duplicated_template_id: null
    // }

    const service = createServiceClient();
    const { error: upsertError } = await service.from('notion_accounts').upsert({
      user_id: user.id,
      workspace_id: tokenData.workspace_id,
      workspace_name: tokenData.workspace_name || 'Notion Workspace',
      workspace_icon: tokenData.workspace_icon || null,
      access_token: tokenData.access_token,
      bot_id: tokenData.bot_id || null,
      owner_type: tokenData.owner?.type || 'user',
      duplicated_template_id: tokenData.duplicated_template_id || null,
    }, { onConflict: 'user_id, workspace_id' });

    if (upsertError) {
      console.error('Notion upsert error:', upsertError);
      throw new Error('Failed to save Notion account: ' + upsertError.message);
    }

    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/settings?success=notion_connected');
  } catch (err) {
    console.error('Notion callback error:', err);
    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL! + '/settings?error=notion_failed');
  }
}
