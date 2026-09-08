-- Internal (linked-form) opportunities should always sort ahead of external
-- ones on the member-facing list. linked_form_id itself can't be the sort
-- key (each value is a unique UUID, so a display_order tiebreak would never
-- fire within the group) — expose a boolean grouping column instead.

-- Recreate the public read view to expose the new column. CREATE OR REPLACE VIEW can
-- only append columns, not reposition existing ones — is_internal goes at the end.
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
  linked_form_id,
  (linked_form_id IS NOT NULL) AS is_internal
FROM public.opportunities
WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
ORDER BY is_internal DESC, display_order;
