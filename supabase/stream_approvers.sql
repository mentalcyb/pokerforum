-- Lets the owner give a member the right to approve streamers (pokerforum.ge/streams).
-- Run once in the Supabase SQL Editor; safe to re-run.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_approve_streams BOOLEAN NOT NULL DEFAULT FALSE;

-- Extends the role lock (supabase/lock_roles.sql) to this permission too:
-- only the site's server can change it, nobody can grant it to themselves.
CREATE OR REPLACE FUNCTION public.protect_profile_roles() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false; NEW.is_moderator := false; NEW.is_banned := false; NEW.can_approve_streams := false;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.is_moderator IS DISTINCT FROM OLD.is_moderator
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.can_approve_streams IS DISTINCT FROM OLD.can_approve_streams THEN
      RAISE EXCEPTION 'roles can only be changed by the site';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'profiles can only be deleted by the site';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_profile_roles ON public.profiles;
CREATE TRIGGER protect_profile_roles BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_roles();

-- Check: should return can_approve_streams
SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'can_approve_streams';
