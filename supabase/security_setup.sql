-- Admin → Security tab: IP / login logging. Run once in the Supabase SQL Editor. Safe to re-run.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip TEXT;

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

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read all sessions" ON public.user_sessions;
CREATE POLICY "Admins can read all sessions" ON public.user_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Check: should return 2 rows (last_ip, user_sessions)
SELECT 'last_ip' AS ok FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_ip'
UNION ALL
SELECT 'user_sessions' FROM information_schema.tables WHERE table_name = 'user_sessions';
