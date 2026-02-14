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

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No Google accounts connected' },
        { status: 400 }
      );
    }

    // Sync each account
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

    // After syncing, trigger Curator Agent to auto-organize new items
    try {
      const { CuratorAgent } = await import('@/lib/agents/curator');
      const curator = new CuratorAgent();
      const curatorResult = await curator.execute(user.id, 'post_sync');

      return NextResponse.json({
        synced: syncResults.length,
        accounts: syncResults,
        curator: curatorResult.success ? curatorResult.output : { error: curatorResult.error },
      });
    } catch (curatorErr) {
      console.error('Curator agent error:', curatorErr);
      return NextResponse.json({
        synced: syncResults.length,
        accounts: syncResults,
        curator: { error: 'Curator agent failed' },
      });
    }
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
