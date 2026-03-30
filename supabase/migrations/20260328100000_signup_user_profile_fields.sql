  -- Persist signup metadata (first_name, last_name, major, expected_graduation) into public.users.

  CREATE OR REPLACE FUNCTION public.handle_new_user_link()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    existing_phone text;
    row_count int;
    meta_first text;
    meta_last text;
    meta_major text;
    meta_grad text;
  BEGIN
    meta_first := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
    meta_last := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
    meta_major := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'major', '')), '');
    meta_grad := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'expected_graduation', '')), '');

    UPDATE public.users
    SET
      auth_id = NEW.id,
      first_name = COALESCE(meta_first, first_name),
      last_name = COALESCE(meta_last, last_name),
      major = COALESCE(meta_major, major),
      expected_graduation = COALESCE(meta_grad, expected_graduation),
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
      INSERT INTO public.users (
        auth_id,
        email,
        first_name,
        last_name,
        major,
        expected_graduation
      )
      VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(meta_first, ''),
        COALESCE(meta_last, ''),
        COALESCE(meta_major, ''),
        COALESCE(meta_grad, '')
      );
    END IF;

    RETURN NEW;
  END;
  $$;

  COMMENT ON FUNCTION public.handle_new_user_link() IS
    'After auth.users insert: link or create public.users; apply signup metadata (first_name, last_name, major, expected_graduation).';
