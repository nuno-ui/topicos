-- =====================================================
-- Migration 015: Contact-Based Assignment
-- =====================================================
-- Adds contact references to topic_tasks (assignee) and topics (owner)
-- so assignments link to real contacts instead of free-text names.
-- Keeps existing text columns for backward compatibility / display fallback.

-- 1. Add assignee_contact_id to topic_tasks
ALTER TABLE public.topic_tasks
  ADD COLUMN IF NOT EXISTS assignee_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_topic_tasks_assignee_contact
  ON public.topic_tasks(assignee_contact_id);

-- 2. Add owner_contact_id to topics
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS owner_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_topics_owner_contact
  ON public.topics(owner_contact_id);

COMMENT ON COLUMN public.topic_tasks.assignee_contact_id IS 'Reference to contacts table for the task assignee. assignee text column kept as display fallback.';
COMMENT ON COLUMN public.topics.owner_contact_id IS 'Reference to contacts table for the topic owner. owner text column kept as display fallback.';
