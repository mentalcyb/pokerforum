-- Daily poker news in Georgian.
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once. Only adds a new table; nothing existing is changed.

CREATE TABLE IF NOT EXISTS public.news_items (
  id            BIGSERIAL   PRIMARY KEY,
  source        TEXT        NOT NULL,              -- e.g. 'PokerNews'
  source_url    TEXT        NOT NULL UNIQUE,       -- original article (never fetched twice)
  title_en      TEXT        NOT NULL,              -- original headline
  title_ka      TEXT        NOT NULL,              -- Georgian headline (AI)
  summary_ka    TEXT        NOT NULL,              -- 2–3 sentence Georgian summary (AI)
  summary_en    TEXT        NOT NULL,              -- short English summary (AI)
  published_at  TIMESTAMPTZ NOT NULL,
  hidden        BOOLEAN     NOT NULL DEFAULT FALSE, -- admins can hide a bad item
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_items_published_idx ON public.news_items (published_at DESC);

ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

-- Everyone can read visible news; only the server (service role) writes.
DROP POLICY IF EXISTS "Anyone can read visible news" ON public.news_items;
CREATE POLICY "Anyone can read visible news"
  ON public.news_items
  FOR SELECT
  USING (hidden = FALSE);

-- Check: should return news_items
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'news_items';
