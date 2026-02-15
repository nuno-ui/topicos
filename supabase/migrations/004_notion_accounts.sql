-- =====================================================
-- Migration: Add Notion integration support
-- =====================================================

-- 1. Create notion_accounts table
CREATE TABLE IF NOT EXISTS notion_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  workspace_name text,
  workspace_icon text,
  access_token text NOT NULL,
  bot_id text,
  owner_type text, -- 'user' or 'workspace'
  duplicated_template_id text,
  last_sync_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- RLS for notion_accounts
ALTER TABLE notion_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notion accounts" ON notion_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_notion_accounts_user_id ON notion_accounts(user_id);

-- Add 'notion' as valid source in items table (items.source is text, no enum constraint needed)
COMMENT ON TABLE notion_accounts IS 'Connected Notion workspace accounts for searching pages and databases';
