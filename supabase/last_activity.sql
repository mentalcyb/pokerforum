-- "Recent discussions": a topic jumps to the top when someone replies (like a classic forum).
-- Run once in the SQL Editor; safe to re-run. (Run after supabase/counts.sql.)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
UPDATE public.posts p SET last_activity_at = GREATEST(p.created_at, COALESCE((SELECT MAX(r.created_at) FROM public.replies r WHERE r.post_id = p.id), p.created_at));
ALTER TABLE public.posts ALTER COLUMN last_activity_at SET DEFAULT NOW();
CREATE INDEX IF NOT EXISTS posts_last_activity_idx ON public.posts (last_activity_at DESC);

CREATE OR REPLACE FUNCTION public.sync_reply_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid bigint := COALESCE(NEW.post_id, OLD.post_id);
BEGIN
  UPDATE posts SET
    reply_count = (SELECT COUNT(*) FROM replies WHERE post_id = pid),
    last_activity_at = GREATEST(created_at, COALESCE((SELECT MAX(created_at) FROM replies WHERE post_id = pid), created_at))
  WHERE id = pid;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sync_reply_count ON public.replies;
CREATE TRIGGER sync_reply_count AFTER INSERT OR DELETE ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.sync_reply_count();

-- Check: the most recently active topics
SELECT id, title, last_activity_at FROM public.posts ORDER BY last_activity_at DESC LIMIT 5;
