import type { ItemSource } from '@/types/database';

/**
 * A normalized item shape returned by all connectors.
 * Matches the Item insert shape minus user_id and account_id
 * (those are added by the sync engine).
 */
export interface NormalizedItem {
  external_id: string;
  title: string;
  snippet: string | null;
  body: string | null;
  url: string | null;
  occurred_at: string;
  source: ItemSource;
  metadata: Record<string, unknown>;
}

/**
 * Standard result returned by every connector fetch function.
 */
export interface ConnectorResult {
  items: NormalizedItem[];
  nextCursor: string | null;
}
