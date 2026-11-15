-- "Reply to" a specific comment: each reply can point to the comment it answers.
-- Run once in the Supabase SQL Editor; safe to re-run.
ALTER TABLE public.replies ADD COLUMN IF NOT EXISTS reply_to BIGINT REFERENCES public.replies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS replies_reply_to_idx ON public.replies (reply_to);

-- Check: should return reply_to
SELECT column_name FROM information_schema.columns WHERE table_name = 'replies' AND column_name = 'reply_to';
