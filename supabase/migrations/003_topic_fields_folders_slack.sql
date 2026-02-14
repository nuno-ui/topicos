-- =====================================================
-- Migration: Add folders, extended topic fields, and Slack support
-- =====================================================

-- 1. Add folder and extended fields to topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS folder text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS start_date timestamptz DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS due_date timestamptz DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS owner text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS stakeholders text[] DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS tags text[] DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS budget text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS time_estimate_hours numeric DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS time_spent_hours numeric DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS risk_level text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS client text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS company text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS department text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS goal text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS outcome text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS url text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS repo_url text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS color text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS icon text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT NULL;

-- Index on folder for fast grouping
CREATE INDEX IF NOT EXISTS idx_topics_folder ON topics(user_id, folder) WHERE folder IS NOT NULL;

-- Index on tags for fast filtering (GIN for array ops)
CREATE INDEX IF NOT EXISTS idx_topics_tags ON topics USING GIN(tags) WHERE tags IS NOT NULL;

-- 2. Create slack_accounts table
CREATE TABLE IF NOT EXISTS slack_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  team_name text NOT NULL,
  bot_user_id text,
  access_token text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_sync_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- RLS for slack_accounts
ALTER TABLE slack_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own slack accounts" ON slack_accounts
  FOR ALL USING (auth.uid() = user_id);

-- 3. Add 'slack' as valid source in items (already text type, no enum constraint needed)
-- Items table already accepts any ItemSource string, so no schema change needed.

COMMENT ON COLUMN topics.folder IS 'Folder name for grouping topics. NULL means unfiled.';
COMMENT ON COLUMN topics.risk_level IS 'low | medium | high | critical';
COMMENT ON COLUMN topics.progress_percent IS '0 to 100';
COMMENT ON TABLE slack_accounts IS 'Connected Slack workspace accounts for syncing messages';
