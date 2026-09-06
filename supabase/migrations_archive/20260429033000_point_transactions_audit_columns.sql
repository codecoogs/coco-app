-- Point transaction auditing: updated_on / updated_by

ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS updated_on timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.point_transactions_set_updated_on()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_on = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS point_transactions_set_updated_on_trg ON public.point_transactions;
CREATE TRIGGER point_transactions_set_updated_on_trg
BEFORE UPDATE ON public.point_transactions
FOR EACH ROW
EXECUTE FUNCTION public.point_transactions_set_updated_on();

