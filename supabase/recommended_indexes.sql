-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run any time: every statement uses IF NOT EXISTS, so it's a no-op
-- for anything that already exists.
--
-- Why: posts/replies/profiles/messages were created through the Table Editor,
-- and Postgres does NOT automatically index a foreign-key column (only
-- primary keys and UNIQUE constraints get an automatic index). Every one of
-- these columns is filtered or ordered on directly by the app's queries, so
-- without an index each request does a sequential scan that gets slower —
-- and burns more of the free-tier's shared CPU/egress — as the tables grow.

-- posts: filtered by category (category page, admin move-topic) and by
-- author (profile page post count, admin user delete); sorted by created_at
-- everywhere (home, category, admin).
CREATE INDEX IF NOT EXISTS posts_category_id_idx ON public.posts(category_id);
CREATE INDEX IF NOT EXISTS posts_user_id_idx     ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx  ON public.posts(created_at DESC);

-- replies: filtered by post (thread view, delete-post cascade) and by
-- author (admin user delete); the "load earlier replies" pagination filters
-- and sorts by created_at within a post.
CREATE INDEX IF NOT EXISTS replies_post_id_idx        ON public.replies(post_id);
CREATE INDEX IF NOT EXISTS replies_user_id_idx         ON public.replies(user_id);
CREATE INDEX IF NOT EXISTS replies_post_created_at_idx ON public.replies(post_id, created_at DESC);

-- profiles: username is looked up on every user-profile page view and on
-- every registration/username-change (uniqueness check); last_seen powers
-- the "online users" widget (gte filter on every home page load).
CREATE INDEX IF NOT EXISTS profiles_username_idx  ON public.profiles(username);
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles(last_seen DESC);

-- messages: inbox loads everything where the user is sender OR receiver;
-- the navbar unread-count check filters receiver_id + read on every page load.
CREATE INDEX IF NOT EXISTS messages_sender_id_idx            ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx           ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS messages_receiver_unread_idx       ON public.messages(receiver_id, read);

-- Optional, data-integrity fix rather than a performance one: the app checks
-- "is this username taken?" in application code (profile page), but nothing
-- stops two concurrent signups from racing past that check and creating two
-- profiles with the same username. Run check_indexes.sql first — if the
-- duplicate-username query there returns zero rows, this is safe to apply:
--
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
