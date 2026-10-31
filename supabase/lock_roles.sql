-- Locks member roles in the database: only the site's server (service role) can change
-- is_admin / is_moderator / is_banned or delete a profile. Stops anyone from making themselves
-- admin through the browser, whatever the other policies say. Run once in the SQL Editor; safe to re-run.
CREATE OR REPLACE FUNCTION public.protect_profile_roles() RETURNS trigger
-- runs with the caller's rights (not SECURITY DEFINER), so current_user is the real caller
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false; NEW.is_moderator := false; NEW.is_banned := false;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.is_moderator IS DISTINCT FROM OLD.is_moderator
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
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

-- Check: should return 1
SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'protect_profile_roles';
