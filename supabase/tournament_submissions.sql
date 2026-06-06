-- Run this in Supabase SQL Editor
-- Creates the tournament_submissions table

CREATE TABLE IF NOT EXISTS public.tournament_submissions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  location      TEXT        NOT NULL,
  dates         TEXT        NOT NULL,
  buyin         TEXT,
  guarantee     TEXT,
  website       TEXT,
  submitted_by  TEXT,
  status        TEXT        DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tournament_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert
CREATE POLICY "Anyone can submit tournaments"
  ON public.tournament_submissions
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read submissions
CREATE POLICY "Admins can read submissions"
  ON public.tournament_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Only admins can update status
CREATE POLICY "Admins can update submissions"
  ON public.tournament_submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
