-- =====================================================
-- Migration 010: Add body column to topic_items
-- =====================================================
-- CRITICAL FIX: The app code (enrichAndCacheItemContent in src/lib/search/content.ts)
-- stores full fetched content (Notion pages, Gmail bodies, Drive docs, Slack messages)
-- in topic_items.body — but this column was never created in the database.
--
-- Without this column:
-- - Auto-enrich silently fails (Supabase update errors on missing column)
-- - AI agents only get short snippets instead of full content
-- - Topic summaries miss rich Notion page content, full email bodies, etc.
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR:
-- Go to https://app.supabase.com → your project → SQL Editor → paste & run

-- Add body column for storing enriched/fetched full content
ALTER TABLE public.topic_items ADD COLUMN IF NOT EXISTS body text;

-- DONE! Auto-enrich will now store full content for AI agents to use.
