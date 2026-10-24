-- App (PWA) usage statistics shown in the admin panel. Run once in the Supabase SQL Editor. Safe to re-run.
-- Anonymous: a random device id kept in the phone's browser — no names, emails or IP addresses.
CREATE TABLE IF NOT EXISTS public.app_events (
  id          BIGSERIAL PRIMARY KEY,
  device_id   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('install', 'open')),
  platform    TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'desktop', 'other')),
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, kind, day)
);
CREATE INDEX IF NOT EXISTS app_events_day_idx ON public.app_events (day);
-- only the site's API reads and writes it
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Check: should return 0
SELECT COUNT(*) FROM public.app_events;
