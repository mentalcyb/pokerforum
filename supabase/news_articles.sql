-- Full Georgian articles for news stories (shown on pokerforum.ge/news/<id>).
-- Run once in the Supabase SQL Editor. Safe to run more than once; only adds a column.
ALTER TABLE public.news_items ADD COLUMN IF NOT EXISTS body_ka TEXT;

-- Check: should return body_ka
SELECT column_name FROM information_schema.columns WHERE table_name = 'news_items' AND column_name = 'body_ka';
