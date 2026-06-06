-- Run this in Supabase SQL Editor
-- Adds last_ip column to profiles table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_ip TEXT;
