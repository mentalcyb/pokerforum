-- Concierge chat for visitors coming to poker series in Georgia (Tbilisi / Batumi).
-- Run once in the Supabase SQL Editor. Safe to re-run.
CREATE TABLE IF NOT EXISTS public.concierge_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL,                 -- the visitor's secret for this chat
  lang        TEXT NOT NULL,                 -- visitor's chosen language (en, ru, tr, …)
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'done')),
  human       BOOLEAN NOT NULL DEFAULT FALSE, -- a team member took over: the bot stops answering
  summary_ka  TEXT,                          -- short Georgian summary of the request (for the team)
  unread      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.concierge_messages (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     UUID NOT NULL REFERENCES public.concierge_chats(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('guest', 'bot', 'team')),
  text        TEXT NOT NULL,                 -- as shown to the visitor (their language)
  text_ka     TEXT,                          -- Georgian, for the team
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS concierge_messages_chat_idx ON public.concierge_messages (chat_id, id);
CREATE INDEX IF NOT EXISTS concierge_chats_updated_idx ON public.concierge_chats (updated_at DESC);
-- What the bot may say about the series, venues and prices (edited by the team in the admin panel)
CREATE TABLE IF NOT EXISTS public.concierge_settings (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  knowledge   TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.concierge_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
-- private: only the site's server reads and writes these
ALTER TABLE public.concierge_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_settings ENABLE ROW LEVEL SECURITY;

-- Check: should return 3
SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('concierge_chats', 'concierge_messages', 'concierge_settings');
