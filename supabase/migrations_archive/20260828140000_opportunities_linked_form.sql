-- Let an opportunity route to an internal form instead of an external URL.
-- Exactly one link target is required: link_url XOR linked_form_id.

ALTER TABLE public.opportunities
  ADD COLUMN linked_form_id uuid REFERENCES public.forms(id) ON DELETE SET NULL;

ALTER TABLE public.opportunities
  ALTER COLUMN link_url DROP NOT NULL;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_link_target_chk
  CHECK ((link_url IS NOT NULL) <> (linked_form_id IS NOT NULL));

-- Recreate the public read view to expose the new column. CREATE OR REPLACE VIEW can
-- only append columns, not reposition existing ones — linked_form_id goes at the end.
-- No join to forms: the member-facing view only needs the id to decide routing.
CREATE OR REPLACE VIEW public.active_opportunities WITH (security_invoker = on) AS
SELECT
  id,
  title,
  description,
  link_url,
  category,
  icon_url,
  is_active,
  display_order,
  expires_at,
  created_at,
  updated_at,
  created_by,
  updated_by,
  company_name,
  location,
  employment_type,
  salary,
  source,
  external_id,
  field,
  linked_form_id
FROM public.opportunities
WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
ORDER BY display_order;

-- Lets an officer with manage_opportunities (but not necessarily manage_forms)
-- pick any form to link to — forms_select_manage RLS only grants visibility to
-- manage_forms holders, so this SECURITY DEFINER function bridges that gap.
CREATE OR REPLACE FUNCTION public.list_forms_for_opportunity_linking()
RETURNS TABLE (id uuid, title text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.title, f.status
  FROM public.forms f
  WHERE public.current_user_has_permission('manage_opportunities')
     OR public.current_user_has_permission('manage_forms')
  ORDER BY f.title;
$$;

COMMENT ON FUNCTION public.list_forms_for_opportunity_linking() IS
  'Lists all forms (any status) for the opportunity-linking picker. Permission-gated inside the function since it is SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.list_forms_for_opportunity_linking() FROM public;
GRANT EXECUTE ON FUNCTION public.list_forms_for_opportunity_linking() TO authenticated, service_role;
