-- 012_topic_hierarchy.sql
-- Add parent-child topic relationships (sub-topics) with max 3-level depth

-- 1. Add parent_topic_id column
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS parent_topic_id uuid
  REFERENCES public.topics(id) ON DELETE SET NULL;

-- 2. Index for efficient child lookups
CREATE INDEX IF NOT EXISTS idx_topics_parent_topic_id
  ON public.topics(parent_topic_id);

-- 3. Depth constraint trigger: max 3 levels (root=0, child=1, grandchild=2)
--    Also prevents circular references and self-parenting
CREATE OR REPLACE FUNCTION check_topic_depth()
RETURNS TRIGGER AS $$
DECLARE
  depth integer := 0;
  current_parent uuid := NEW.parent_topic_id;
BEGIN
  -- Prevent self-parenting
  IF NEW.parent_topic_id = NEW.id THEN
    RAISE EXCEPTION 'A topic cannot be its own parent';
  END IF;

  -- Walk up the ancestor chain to check depth and circular references
  WHILE current_parent IS NOT NULL LOOP
    depth := depth + 1;
    -- Max depth: new topic at depth 2 means parent is at 1, grandparent at 0 = 3 levels total
    IF depth > 2 THEN
      RAISE EXCEPTION 'Topic hierarchy cannot exceed 3 levels';
    END IF;
    -- Check for circular reference
    IF current_parent = NEW.id THEN
      RAISE EXCEPTION 'Circular topic hierarchy detected';
    END IF;
    SELECT parent_topic_id INTO current_parent
    FROM public.topics WHERE id = current_parent;
  END LOOP;

  -- If this topic already has children, check that nesting it won't exceed depth
  -- (e.g., topic has children → moving it under a parent means children become grandchildren)
  IF EXISTS (SELECT 1 FROM public.topics WHERE parent_topic_id = NEW.id) THEN
    -- This topic has children. It can be at most depth 1 (so children are depth 2)
    IF depth > 1 THEN
      RAISE EXCEPTION 'Cannot nest this topic deeper: it already has children that would exceed max depth';
    END IF;
    -- Check if any children also have children (grandchildren)
    IF EXISTS (
      SELECT 1 FROM public.topics gc
      WHERE gc.parent_topic_id IN (SELECT c.id FROM public.topics c WHERE c.parent_topic_id = NEW.id)
    ) THEN
      -- This topic has grandchildren. It must stay at root level (depth 0)
      IF depth > 0 THEN
        RAISE EXCEPTION 'Cannot nest this topic: it has grandchildren that would exceed max depth';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_topic_depth
  BEFORE INSERT OR UPDATE OF parent_topic_id ON public.topics
  FOR EACH ROW
  WHEN (NEW.parent_topic_id IS NOT NULL)
  EXECUTE FUNCTION check_topic_depth();
