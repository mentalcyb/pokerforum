-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Creates the user_sessions table for IP / activity logging

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address  TEXT,
  user_agent  TEXT,
  action      TEXT        CHECK (action IN ('login', 'register', 'post')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx    ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_created_at_idx ON public.user_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can read sessions
CREATE POLICY "Admins can read all sessions"
  ON public.user_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Inserts happen via service-role key from the API route — no user policy needed
