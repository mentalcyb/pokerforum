-- Keeps reply and post counters right for everyone (also test accounts and other members),
-- maintained by the database instead of the browser. Run once in the SQL Editor; safe to re-run.
CREATE OR REPLACE FUNCTION public.sync_reply_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid bigint := COALESCE(NEW.post_id, OLD.post_id);
BEGIN
  UPDATE posts SET reply_count = (SELECT COUNT(*) FROM replies WHERE post_id = pid) WHERE id = pid;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sync_reply_count ON public.replies;
CREATE TRIGGER sync_reply_count AFTER INSERT OR DELETE ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.sync_reply_count();

CREATE OR REPLACE FUNCTION public.sync_post_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE category_id = NEW.category_id) WHERE id = NEW.category_id;
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE category_id = OLD.category_id) WHERE id = OLD.category_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sync_post_count ON public.posts;
CREATE TRIGGER sync_post_count AFTER INSERT OR DELETE OR UPDATE OF category_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_count();

-- fix the counters that are already wrong
UPDATE public.posts p SET reply_count = (SELECT COUNT(*) FROM public.replies r WHERE r.post_id = p.id);
UPDATE public.categories c SET post_count = (SELECT COUNT(*) FROM public.posts p WHERE p.category_id = c.id);

-- Check: should return 2
SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('sync_reply_count', 'sync_post_count');
