-- Add is_ongoing flag for topics that don't need start/end dates
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS is_ongoing boolean DEFAULT false;
