-- Migration 007: Add area category to folders
-- Folders can be assigned an area (work, personal, career) to categorize them.
-- Topics within a folder should ideally match the folder's area.

ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS area text CHECK (area IN ('work', 'personal', 'career'));
