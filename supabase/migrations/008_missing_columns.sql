-- =====================================================
-- Migration 008: Add missing columns to contacts, folders, topics
-- =====================================================
-- This migration adds all columns that the application code expects
-- but that don't exist in the database yet.
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR:
-- Go to https://app.supabase.com → your project → SQL Editor → paste & run

-- ============================================================
-- 1. CONTACTS: Add 'area' column
-- ============================================================
-- Used to categorize contacts into work/personal/career areas
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS area text CHECK (area IN ('work', 'personal', 'career'));

-- ============================================================
-- 2. FOLDERS: Add 'area' column (if not already added by migration 007)
-- ============================================================
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS area text CHECK (area IN ('work', 'personal', 'career'));

-- ============================================================
-- 3. FOLDERS: Add 'color' and 'icon' columns
-- ============================================================
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS icon text;

-- ============================================================
-- 4. TOPICS: Add missing fields used by the app
-- ============================================================
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS start_date timestamptz;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS priority integer CHECK (priority >= 0 AND priority <= 5);
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100);
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS owner text;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS stakeholders text[] DEFAULT '{}';
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS urgency_score integer;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS goal text;

-- ============================================================
-- 5. TOPICS: Update status check constraint to include 'paused'
-- ============================================================
ALTER TABLE public.topics DROP CONSTRAINT IF EXISTS topics_status_check;
ALTER TABLE public.topics ADD CONSTRAINT topics_status_check CHECK (status IN ('active', 'paused', 'completed', 'archived'));

-- ============================================================
-- 6. FEEDBACK table (for bug/improvement reporter)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bug', 'improvement', 'idea')),
  title text NOT NULL,
  description text,
  page_url text,
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feedback" ON public.feedback
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own feedback" ON public.feedback
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. Indexes for new columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_area ON public.contacts(area);
CREATE INDEX IF NOT EXISTS idx_folders_area ON public.folders(area);
CREATE INDEX IF NOT EXISTS idx_topics_folder_id ON public.topics(folder_id);
CREATE INDEX IF NOT EXISTS idx_topics_priority ON public.topics(priority);
CREATE INDEX IF NOT EXISTS idx_topics_status ON public.topics(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);

-- ============================================================
-- 8. Fix topic_items source check constraint
-- ============================================================
-- The existing constraint only allows a limited set of sources.
-- The app now supports: gmail, calendar, drive, slack, notion, manual, link
ALTER TABLE public.topic_items DROP CONSTRAINT IF EXISTS topic_items_source_check;
ALTER TABLE public.topic_items ADD CONSTRAINT topic_items_source_check
  CHECK (source IN ('gmail', 'calendar', 'drive', 'slack', 'notion', 'manual', 'link'));

-- Also update items table source check to include 'link'
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_source_check;
ALTER TABLE public.items ADD CONSTRAINT items_source_check
  CHECK (source IN ('gmail', 'calendar', 'drive', 'slack', 'notion', 'manual', 'link'));

-- ============================================================
-- DONE! All columns and tables are now in sync with the app.
-- ============================================================
