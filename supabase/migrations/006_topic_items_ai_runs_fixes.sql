-- =====================================================
-- Migration 006: topic_items + ai_runs tables + constraint fixes
-- =====================================================
-- This migration documents and creates the topic_items and ai_runs tables
-- that were previously created manually in Supabase, and fixes several
-- schema/code mismatches found during database analysis.
--
-- CRITICAL CONTEXT:
-- The v1 schema had: items (raw data) + topic_links (junction table)
-- The v2 code uses: topic_items (denormalized: items always linked to a topic)
-- The v1 schema had: ai_outputs (limited logging)
-- The v2 code uses: ai_runs (comprehensive AI execution logging)

-- ============================================================
-- 1. CREATE topic_items TABLE (if not exists)
-- ============================================================
-- This is a denormalized table combining items + topic linking.
-- Each row is an item that belongs to a specific topic.

CREATE TABLE IF NOT EXISTS public.topic_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_account_id uuid,
  external_id text,
  title text NOT NULL,
  snippet text DEFAULT '',
  body text,
  url text DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  linked_by text,
  confidence float,
  link_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for topic_items
CREATE INDEX IF NOT EXISTS idx_topic_items_user_id ON public.topic_items(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_items_topic_id ON public.topic_items(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_items_source ON public.topic_items(source);
CREATE INDEX IF NOT EXISTS idx_topic_items_occurred_at ON public.topic_items(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_items_created_at ON public.topic_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_items_external_id ON public.topic_items(external_id);

-- RLS for topic_items
ALTER TABLE public.topic_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topic_items" ON public.topic_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own topic_items" ON public.topic_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own topic_items" ON public.topic_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own topic_items" ON public.topic_items
  FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger for topic_items
CREATE OR REPLACE TRIGGER update_topic_items_updated_at
  BEFORE UPDATE ON public.topic_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 2. CREATE ai_runs TABLE (if not exists)
-- ============================================================
-- Logs all AI operations: agent runs, AI find, analyze, etc.
-- Replaces the limited ai_outputs table for comprehensive tracking.

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  kind text NOT NULL,
  model text NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
  input_summary text,
  output_json jsonb DEFAULT '{}'::jsonb,
  tokens_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ai_runs
CREATE INDEX IF NOT EXISTS idx_ai_runs_user_id ON public.ai_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_kind ON public.ai_runs(kind);
CREATE INDEX IF NOT EXISTS idx_ai_runs_created_at ON public.ai_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_topic_id ON public.ai_runs(topic_id);

-- RLS for ai_runs
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_runs" ON public.ai_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_runs" ON public.ai_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 3. FIX items.source CHECK CONSTRAINT
-- ============================================================
-- v1 only allowed: gmail, calendar, drive, manual
-- Code now uses: gmail, calendar, drive, slack, notion, manual
-- Drop old constraint and add expanded one

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_source_check;
ALTER TABLE public.items ADD CONSTRAINT items_source_check
  CHECK (source IN ('gmail', 'calendar', 'drive', 'slack', 'notion', 'manual'));


-- ============================================================
-- 4. FIX agent_runs.agent_type CHECK CONSTRAINT
-- ============================================================
-- v2 migration only allowed 7 types but the code uses 17+ agent types
-- Since new agents can be added anytime, remove the restrictive CHECK

ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_type_check;
-- No replacement constraint - agent types are managed by application code


-- ============================================================
-- 5. FIX contacts.email - allow NULL emails
-- ============================================================
-- The code allows creating contacts without emails (e.g., from calendar
-- attendees where only a name is available). The NOT NULL constraint
-- on email blocks this. Make it nullable.
-- Note: The unique constraint on (user_id, email) still works with NULLs
-- in PostgreSQL (NULL != NULL), so multiple contacts without emails are ok.

ALTER TABLE public.contacts ALTER COLUMN email DROP NOT NULL;


-- ============================================================
-- 6. Ensure google_accounts has proper upsert support
-- ============================================================
-- The code upserts on (user_id, email) but the unique constraint is on
-- (user_id, provider_account_id). Add the missing unique constraint.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'google_accounts_user_id_email_key'
  ) THEN
    ALTER TABLE public.google_accounts ADD CONSTRAINT google_accounts_user_id_email_key UNIQUE(user_id, email);
  END IF;
END $$;


-- ============================================================
-- 7. Add missing topic_items foreign key relationship for Supabase
-- ============================================================
-- Supabase PostgREST needs proper FK relationships for nested selects
-- like: .select('*, topic_items(count)') on topics table
-- The FK from topic_items.topic_id → topics.id enables this automatically.
-- No action needed as the FK is in the CREATE TABLE above.

-- Also ensure topic_items → topics relationship for:
-- .select('title, source, occurred_at, topics(title)') on topic_items
-- This requires the FK topic_items.topic_id → topics.id (already defined above)


-- ============================================================
-- 8. Add missing ai_runs → topics relationship for Supabase
-- ============================================================
-- Code uses: .select('id, kind, ..., topic_id, topics(title)') on ai_runs
-- This requires the FK ai_runs.topic_id → topics.id (already defined above)


-- ============================================================
-- COMMENTS (documentation)
-- ============================================================

COMMENT ON TABLE public.topic_items IS 'Items (emails, events, files, etc.) linked to specific topics. Denormalized from v1 items + topic_links tables.';
COMMENT ON COLUMN public.topic_items.source IS 'Source system: gmail, calendar, drive, slack, notion, manual';
COMMENT ON COLUMN public.topic_items.source_account_id IS 'ID of the account (google_accounts, slack_accounts, etc.) this item came from';
COMMENT ON COLUMN public.topic_items.external_id IS 'ID from the source system (Gmail message ID, Calendar event ID, etc.)';
COMMENT ON COLUMN public.topic_items.linked_by IS 'How this item was linked: user, ai, curator, etc.';
COMMENT ON COLUMN public.topic_items.confidence IS 'AI confidence score (0-1) if auto-linked';
COMMENT ON COLUMN public.topic_items.link_reason IS 'AI reasoning for why this item was linked to the topic';

COMMENT ON TABLE public.ai_runs IS 'Log of all AI operations: agent runs, analysis, search, etc.';
COMMENT ON COLUMN public.ai_runs.kind IS 'Operation type: ai_find, analyze_topic, agent_auto_tag, agent_daily_briefing, etc.';
COMMENT ON COLUMN public.ai_runs.model IS 'AI model used (e.g., claude-sonnet-4-5-20250929)';
COMMENT ON COLUMN public.ai_runs.input_summary IS 'Brief description of the input/context';
COMMENT ON COLUMN public.ai_runs.output_json IS 'Full JSON output from the AI operation';
