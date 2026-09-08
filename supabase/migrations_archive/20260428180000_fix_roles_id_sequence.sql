-- Repair public.roles_id_seq when it falls behind actual MAX(id).
-- Symptom: INSERT into roles (without id) fails with duplicate key on Role_pkey / roles_pkey.
-- Common causes: manual inserts with explicit ids, restores, or copied data.

DO $$
DECLARE
  max_id bigint;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.roles;

  IF max_id = 0 THEN
    PERFORM setval('public.roles_id_seq', 1, false);
  ELSE
    PERFORM setval('public.roles_id_seq', max_id, true);
  END IF;
END $$;
