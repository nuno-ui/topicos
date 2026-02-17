-- Migration 011: Contact Knowledge Base
-- Adds: is_favorite column on contacts, contact_items table for direct attachments

-- 1. Add is_favorite to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_is_favorite ON public.contacts(user_id, is_favorite) WHERE is_favorite = true;

-- 2. Create contact_items table for direct contact attachments
-- Sources: 'manual' (notes), 'link' (URLs), 'document' (conversation histories, meeting notes), 'notion' (linked pages)
CREATE TABLE IF NOT EXISTS public.contact_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('manual', 'link', 'document', 'notion')),
  title text NOT NULL,
  snippet text DEFAULT '',
  body text,
  url text DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contact items" ON public.contact_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contact items" ON public.contact_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contact items" ON public.contact_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contact items" ON public.contact_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contact_items_contact ON public.contact_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_items_user ON public.contact_items(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_items_occurred ON public.contact_items(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_items_source ON public.contact_items(source);
