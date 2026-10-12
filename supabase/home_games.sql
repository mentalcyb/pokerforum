-- Home games: private poker tables for friends (play chips only).
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once.

-- ── Tables ─────────────────────────────────────────────────────────────────

-- Public table state. Everyone seated at a table may read it (and receives
-- real-time updates); only the server writes to it.
CREATE TABLE IF NOT EXISTS public.poker_tables (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,          -- invite link code
  name        TEXT        NOT NULL,
  host_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config      JSONB       NOT NULL,                 -- blinds, stack, seats, timer
  state       JSONB       NOT NULL,                 -- seats, board, pot, log … (no hidden cards)
  player_ids  UUID[]      NOT NULL DEFAULT '{}',    -- who may read this row
  version     INTEGER     NOT NULL DEFAULT 0,       -- optimistic locking
  closed      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS poker_tables_host_idx    ON public.poker_tables (host_id);
CREATE INDEX IF NOT EXISTS poker_tables_players_idx ON public.poker_tables USING GIN (player_ids);

-- Hidden information: the deck and everyone's hole cards. No policies, so
-- only the server (service role) can ever read it.
CREATE TABLE IF NOT EXISTS public.poker_table_secrets (
  table_id  UUID  PRIMARY KEY REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  secret    JSONB NOT NULL DEFAULT '{"deck": [], "hands": {}}'
);

-- ── Row level security ─────────────────────────────────────────────────────

ALTER TABLE public.poker_tables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_table_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players and host can read their tables" ON public.poker_tables;
CREATE POLICY "Players and host can read their tables"
  ON public.poker_tables
  FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = ANY (player_ids));

-- No INSERT/UPDATE/DELETE policies: all writes go through the API with the service role.

-- ── Atomic save with optimistic locking ────────────────────────────────────

-- Saves state + secret together, only if nobody else saved in between.
-- Returns the new version, or -1 if the version was stale (the API retries).
CREATE OR REPLACE FUNCTION public.poker_commit(
  p_table_id   UUID,
  p_version    INTEGER,
  p_state      JSONB,
  p_player_ids UUID[],
  p_secret     JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE public.poker_tables
     SET state = p_state,
         player_ids = p_player_ids,
         version = version + 1,
         updated_at = NOW()
   WHERE id = p_table_id AND version = p_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RETURN -1;
  END IF;
  IF p_secret IS NOT NULL THEN
    UPDATE public.poker_table_secrets SET secret = p_secret WHERE table_id = p_table_id;
  END IF;
  RETURN p_version + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.poker_commit(UUID, INTEGER, JSONB, UUID[], JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poker_commit(UUID, INTEGER, JSONB, UUID[], JSONB) TO service_role;

-- ── Real-time updates ──────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'poker_tables'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_tables;
  END IF;
END $$;

-- Check: should list both tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'poker_%';
