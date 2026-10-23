-- "Where do Georgians play?" — members pick the online poker rooms they play on (pokerforum.ge/rooms).
-- Run once in the Supabase SQL Editor. Safe to re-run.
CREATE TABLE IF NOT EXISTS public.room_votes (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, room)
);
-- Individual votes stay private: only the site's API (service role) reads and writes them,
-- and it publishes totals only.
ALTER TABLE public.room_votes ENABLE ROW LEVEL SECURITY;

-- Check: should return 0
SELECT COUNT(*) FROM public.room_votes;
