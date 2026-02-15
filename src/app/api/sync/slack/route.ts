import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { syncSlackAccount } from '@/lib/sync/engine';

/**
 * POST /api/sync/slack
 *
 * Dedicated Slack sync endpoint — fast because it only syncs Slack,
 * avoiding the timeout that occurs when Google accounts sync first.
 *
 * Body (optional):
 *   - account_id: string  — sync a specific Slack workspace
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let accountId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    accountId = body.account_id;
  } catch {
    // No body is fine
  }

  try {
    let slackAccounts: { id: string }[];

    if (accountId) {
      const { data, error } = await supabase
        .from('slack_accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Slack account not found' },
          { status: 404 }
        );
      }
      slackAccounts = [data];
    } else {
      const { data, error } = await supabase
        .from('slack_accounts')
        .select('id')
        .eq('user_id', user.id);

      if (error || !data || data.length === 0) {
        return NextResponse.json(
          { error: 'No Slack workspaces connected. Connect one in Settings first.' },
          { status: 400 }
        );
      }
      slackAccounts = data;
    }

    const results = [];

    for (const sa of slackAccounts) {
      try {
        const result = await syncSlackAccount(user.id, sa.id);
        results.push({
          account_id: sa.id,
          ...result,
        });
      } catch (err) {
        results.push({
          account_id: sa.id,
          source: 'slack',
          status: 'failed',
          itemsProcessed: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          error: err instanceof Error ? err.message : 'Slack sync error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      accounts: results,
    });
  } catch (err) {
    console.error('Slack sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Slack sync failed' },
      { status: 500 }
    );
  }
}
