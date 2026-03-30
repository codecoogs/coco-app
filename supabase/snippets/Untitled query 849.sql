-- New Supabase Auth users: link existing public.users by email, or insert a minimal row.
-- Previously only UPDATE ran, so brand-new emails never got a public.users row.

CREATE OR REPLACE FUNCTION public.handle_new_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_phone text;
  row_count int;
BEGIN
  UPDATE public.users
  SET
    auth_id = NEW.id,
    discord = COALESCE(
      discord,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name'
    )
  WHERE email = NEW.email
  RETURNING phone INTO existing_phone;

  GET DIAGNOSTICS row_count = ROW_COUNT;

  IF row_count > 0 THEN
    IF existing_phone IS NOT NULL AND existing_phone != '' THEN
      UPDATE auth.users
      SET phone = existing_phone
      WHERE id = NEW.id;
    END IF;
  ELSE
    INSERT INTO public.users (auth_id, email)
    VALUES (NEW.id, COALESCE(NEW.email, ''));
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user_link() IS
  'After auth.users insert: attach auth_id to existing public.users by email, else create public.users row.';
