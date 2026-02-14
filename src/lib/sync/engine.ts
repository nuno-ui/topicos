import { createServiceClient } from '@/lib/supabase/server';
import { refreshAccessToken } from '@/lib/connectors/google/auth';
import { fetchGmailMessages } from '@/lib/connectors/google/gmail';
import { fetchCalendarEvents } from '@/lib/connectors/google/calendar';
import { fetchDriveFiles } from '@/lib/connectors/google/drive';
import type { ItemSource } from '@/types/database';
import type { ConnectorResult, NormalizedItem } from '@/lib/connectors/google/types';

const ALL_SOURCES: ItemSource[] = ['gmail', 'calendar', 'drive'];

type ConnectorFn = (
  accessToken: string,
  refreshToken: string,
  cursor?: string,
  maxResults?: number
) => Promise<ConnectorResult>;

const CONNECTOR_MAP: Record<string, ConnectorFn> = {
  gmail: fetchGmailMessages,
  calendar: fetchCalendarEvents,
  drive: fetchDriveFiles,
};

interface SyncSourceResult {
  source: ItemSource;
  status: 'completed' | 'failed';
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  error?: string;
}

/**
 * Syncs all (or specified) sources for a given Google account.
 *
 * For each source:
 * 1. Creates a sync_run record (status: running)
 * 2. Retrieves the last successful cursor for incremental sync
 * 3. Refreshes the access token if expired
 * 4. Calls the appropriate connector
 * 5. Upserts items into the items table
 * 6. Updates sync_run with results
 * 7. Updates google_accounts.last_sync_at
 */
export async function syncAccount(
  userId: string,
  accountId: string,
  sources?: string[]
): Promise<SyncSourceResult[]> {
  const supabase = createServiceClient();
  const results: SyncSourceResult[] = [];

  // Determine which sources to sync
  const sourcesToSync = (sources ?? ALL_SOURCES).filter(
    (s): s is ItemSource => s in CONNECTOR_MAP
  );

  // Fetch the google account tokens
  const { data: account, error: accountError } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (accountError || !account) {
    throw new Error(
      `Google account not found: ${accountError?.message ?? 'no account'}`
    );
  }

  let { access_token: accessToken, refresh_token: refreshToken } = account;
  const tokenExpiresAt = new Date(account.token_expires_at);

  // Refresh token if expired (or expiring within 5 minutes)
  if (tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;

      // Update tokens in DB
      await supabase
        .from('google_accounts')
        .update({
          access_token: accessToken,
          token_expires_at: refreshed.expiresAt,
        })
        .eq('id', accountId);
    } catch (err) {
      throw new Error(
        `Failed to refresh access token: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  for (const source of sourcesToSync) {
    const result = await syncSource(
      supabase,
      userId,
      accountId,
      source,
      accessToken,
      refreshToken
    );
    results.push(result);
  }

  // Update last_sync_at on the google account
  await supabase
    .from('google_accounts')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', accountId);

  return results;
}

async function syncSource(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  accountId: string,
  source: ItemSource,
  accessToken: string,
  refreshToken: string
): Promise<SyncSourceResult> {
  const startedAt = new Date().toISOString();

  // Create sync_run record
  const { data: syncRun, error: createError } = await supabase
    .from('sync_runs')
    .insert({
      user_id: userId,
      account_id: accountId,
      source,
      status: 'running' as const,
      started_at: startedAt,
      finished_at: null,
      cursor: null,
      stats: {},
      error: null,
    })
    .select()
    .single();

  if (createError || !syncRun) {
    return {
      source,
      status: 'failed',
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      error: `Failed to create sync_run: ${createError?.message}`,
    };
  }

  try {
    // Get the cursor from the last successful sync_run for this account+source
    const { data: lastRun } = await supabase
      .from('sync_runs')
      .select('cursor')
      .eq('account_id', accountId)
      .eq('source', source)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    const lastCursor = lastRun?.cursor ?? undefined;

    // Call the appropriate connector
    const connector = CONNECTOR_MAP[source];
    const { items, nextCursor } = await connector(
      accessToken,
      refreshToken,
      lastCursor
    );

    // Upsert items
    const { created, updated } = await upsertItems(
      supabase,
      userId,
      accountId,
      source,
      items
    );

    const stats = {
      itemsProcessed: items.length,
      itemsCreated: created,
      itemsUpdated: updated,
    };

    // Update sync_run as completed
    await supabase
      .from('sync_runs')
      .update({
        status: 'completed' as const,
        cursor: nextCursor,
        finished_at: new Date().toISOString(),
        stats,
      })
      .eq('id', syncRun.id);

    return { source, status: 'completed', ...stats };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    // Update sync_run as failed
    await supabase
      .from('sync_runs')
      .update({
        status: 'failed' as const,
        finished_at: new Date().toISOString(),
        error: { message: errorMessage },
      })
      .eq('id', syncRun.id);

    return {
      source,
      status: 'failed',
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      error: errorMessage,
    };
  }
}

/**
 * Upserts normalized items into the items table.
 * On conflict (account_id + source + external_id), updates title, snippet,
 * metadata, and occurred_at.
 *
 * Returns counts of created and updated items.
 */
async function upsertItems(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  accountId: string,
  source: ItemSource,
  items: NormalizedItem[]
): Promise<{ created: number; updated: number }> {
  if (items.length === 0) {
    return { created: 0, updated: 0 };
  }

  // Check which external_ids already exist for this account+source
  const externalIds = items.map((item) => item.external_id);

  const { data: existingItems } = await supabase
    .from('items')
    .select('external_id')
    .eq('account_id', accountId)
    .eq('source', source)
    .in('external_id', externalIds);

  const existingSet = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (existingItems ?? []).map((i: any) => i.external_id)
  );

  let created = 0;
  let updated = 0;

  // Process items in batches to avoid payload limits
  const BATCH_SIZE = 50;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const toInsert = batch.filter(
      (item) => !existingSet.has(item.external_id)
    );
    const toUpdate = batch.filter((item) =>
      existingSet.has(item.external_id)
    );

    // Insert new items
    if (toInsert.length > 0) {
      const rows = toInsert.map((item) => ({
        user_id: userId,
        account_id: accountId,
        source: item.source,
        external_id: item.external_id,
        title: item.title,
        snippet: item.snippet,
        body: item.body,
        url: item.url,
        occurred_at: item.occurred_at,
        metadata: item.metadata,
      }));

      const { error } = await supabase.from('items').insert(rows);
      if (!error) {
        created += toInsert.length;
      } else {
        console.error('Failed to insert items:', error.message);
      }
    }

    // Update existing items
    for (const item of toUpdate) {
      const { error } = await supabase
        .from('items')
        .update({
          title: item.title,
          snippet: item.snippet,
          metadata: item.metadata,
          occurred_at: item.occurred_at,
        })
        .eq('account_id', accountId)
        .eq('source', source)
        .eq('external_id', item.external_id);

      if (!error) {
        updated += 1;
      } else {
        console.error(
          `Failed to update item ${item.external_id}:`,
          error.message
        );
      }
    }
  }

  return { created, updated };
}
