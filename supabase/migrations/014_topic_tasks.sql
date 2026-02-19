-- =====================================================
-- Migration 014: Topic Tasks
-- =====================================================
-- Adds task management for topics: AI-extractable, manually manageable tasks.
-- Tasks belong to topics, have status/priority/assignee, and can be
-- created manually or extracted from linked items by AI agents.

CREATE TABLE IF NOT EXISTS public.topic_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date timestamptz,
  assignee text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_extracted')),
  source_item_ref text,
  position integer DEFAULT 0,
  completed_at timestamptz,
  archived_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topic_tasks_topic_id ON public.topic_tasks(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_tasks_user_id ON public.topic_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_tasks_status ON public.topic_tasks(status);
CREATE INDEX IF NOT EXISTS idx_topic_tasks_created_at ON public.topic_tasks(created_at DESC);

-- RLS
ALTER TABLE public.topic_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topic_tasks" ON public.topic_tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own topic_tasks" ON public.topic_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own topic_tasks" ON public.topic_tasks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own topic_tasks" ON public.topic_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger (reuses existing function)
CREATE OR REPLACE TRIGGER update_topic_tasks_updated_at
  BEFORE UPDATE ON public.topic_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.topic_tasks IS 'Tasks belonging to topics. Can be manually created or AI-extracted from linked items.';
COMMENT ON COLUMN public.topic_tasks.source IS 'How the task was created: manual (by user) or ai_extracted (by AI agent)';
COMMENT ON COLUMN public.topic_tasks.source_item_ref IS 'Brief reference to the source item that generated this task';
COMMENT ON COLUMN public.topic_tasks.position IS 'Sort order within the topic (0 = top)';
