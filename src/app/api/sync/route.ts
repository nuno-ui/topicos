import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { syncAccount, syncSlackAccount } from '@/lib/sync/engine';

/**
 * POST /api/sync
 *
 * Triggers a sync for the authenticated user's Google accounts.
 *
 * Body (optional):
 *   - account_id: string   - sync a specific account (otherwise syncs all)
 *   - sources: string[]    - limit to specific sources (e.g. ['gmail', 'calendar'])
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse optional body
  let accountId: string | undefined;
  let sources: string[] | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    accountId = body.account_id;
    sources = body.sources;
  } catch {
    // No body is fine; we'll sync all accounts
  }

  try {
    // Determine which accounts to sync
    let accounts: { id: string }[];

    if (accountId) {
      // Verify the account belongs to this user
      const { data, error } = await supabase
        .from('google_accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }

      accounts = [data];
    } else {
      // Get all accounts for this user
      const { data, error } = await supabase
        .from('google_accounts')
        .select('id')
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      accounts = data ?? [];
    }

    // Sync each Google account
    const syncResults = [];

    for (const account of accounts) {
      try {
        const results = await syncAccount(user.id, account.id, sources);
        syncResults.push({
          account_id: account.id,
          results,
        });
      } catch (err) {
        syncResults.push({
          account_id: account.id,
          error:
            err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Also sync Slack accounts
    const { data: slackAccounts } = await supabase
      .from('slack_accounts')
      .select('id')
      .eq('user_id', user.id);

    for (const sa of slackAccounts ?? []) {
      try {
        const slackResult = await syncSlackAccount(user.id, sa.id);
        syncResults.push({
          account_id: sa.id,
          results: [slackResult],
        });
      } catch (err) {
        syncResults.push({
          account_id: sa.id,
          error: err instanceof Error ? err.message : 'Slack sync error',
        });
      }
    }

    if (syncResults.length === 0) {
      return NextResponse.json(
        { error: 'No accounts connected. Connect a Google or Slack account first.' },
        { status: 400 }
      );
    }

    // Return sync results (Curator is now manual-only via the Agents page)
    return NextResponse.json({
      synced: syncResults.length,
      accounts: syncResults,
    });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
