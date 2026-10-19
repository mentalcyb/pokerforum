-- Streamers (pokerforum.ge/streams). Run once in the Supabase SQL Editor.
-- Members add their Twitch / YouTube channel; an admin approves it; live status is cached here.
CREATE TABLE IF NOT EXISTS public.streamers (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL CHECK (platform IN ('twitch', 'youtube')),
  channel     TEXT NOT NULL,          -- twitch login, or YouTube channel id (UC...) / @handle
  approved    BOOLEAN NOT NULL DEFAULT FALSE,
  is_live     BOOLEAN NOT NULL DEFAULT FALSE,
  title       TEXT,
  viewers     INTEGER,
  thumbnail   TEXT,
  video_id    TEXT,                   -- YouTube live video id (for the player)
  live_since  TIMESTAMPTZ,
  checked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform)
);
CREATE INDEX IF NOT EXISTS streamers_approved_idx ON public.streamers (approved, is_live);

ALTER TABLE public.streamers ENABLE ROW LEVEL SECURITY;
-- everyone can see approved streamers; changes go through the site's API only
DROP POLICY IF EXISTS "approved streamers are public" ON public.streamers;
CREATE POLICY "approved streamers are public" ON public.streamers FOR SELECT USING (approved = TRUE);

-- Check: should return 0 (empty table)
SELECT COUNT(*) FROM public.streamers;
