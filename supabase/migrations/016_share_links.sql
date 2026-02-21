-- =====================================================
-- Migration 016: Share Links
-- =====================================================
-- Public share links for topics views, scoped to a contact.
-- Recipients can view topics/tasks and leave comments.

CREATE TABLE IF NOT EXISTS public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  area text DEFAULT 'work',
  label text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON public.share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON public.share_links(user_id);

-- Comments on shared views
CREATE TABLE IF NOT EXISTS public.share_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id uuid NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.topic_tasks(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_comments_link ON public.share_comments(share_link_id);

-- RLS: owner-only for share_links
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own share_links" ON public.share_links
  FOR ALL USING (auth.uid() = user_id);
-- Service role can read share_links by token (for public API)

-- RLS: comments are readable by anyone with the link (via service role), writable by anyone
ALTER TABLE public.share_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert share_comments" ON public.share_comments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read share_comments" ON public.share_comments
  FOR SELECT USING (true);

COMMENT ON TABLE public.share_links IS 'Public share links for read-only topic views, optionally scoped to a contact.';
COMMENT ON TABLE public.share_comments IS 'Comments left by recipients on shared topic views.';
