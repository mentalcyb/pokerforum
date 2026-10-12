-- Hand history for home games (replays of finished hands).
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once. Only adds a new table; nothing existing is changed.

CREATE TABLE IF NOT EXISTS public.poker_hands (
  id          BIGSERIAL   PRIMARY KEY,
  table_id    UUID        NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  hand_no     INTEGER     NOT NULL,
  -- full record including every player's hole cards: the API filters what each viewer sees
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS poker_hands_table_idx ON public.poker_hands (table_id, id DESC);

-- No policies: only the server (service role) can read or write, so hidden cards stay hidden.
ALTER TABLE public.poker_hands ENABLE ROW LEVEL SECURITY;

-- Check: should return poker_hands
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'poker_hands';
