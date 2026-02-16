-- =====================================================
-- Migration 009: Fix topic_items source check constraint
-- =====================================================
-- CRITICAL FIX: The topic_items table has a CHECK constraint on the 'source'
-- column that doesn't include 'notion' or 'link', causing all Notion page
-- linking and URL link saving to fail with error 23514.
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR:
-- Go to https://app.supabase.com → your project → SQL Editor → paste & run

-- Fix topic_items source constraint to include all sources
ALTER TABLE public.topic_items DROP CONSTRAINT IF EXISTS topic_items_source_check;
ALTER TABLE public.topic_items ADD CONSTRAINT topic_items_source_check
  CHECK (source IN ('gmail', 'calendar', 'drive', 'slack', 'notion', 'manual', 'link'));

-- Note: public.items table does not exist in this schema, only topic_items.
-- The constraint fix above is sufficient.

-- DONE! Notion pages and links can now be linked to topics.
