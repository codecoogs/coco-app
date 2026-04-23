-- If events.point_category was stored as point_categories.id (text/uuid) and the FK
-- now targets point_categories.name, existing rows can violate the constraint until
-- they store the display name. Safe to re-run: only updates where value matched an id.
UPDATE public.events e
SET point_category = pc.name
FROM public.point_categories pc
WHERE e.point_category IS NOT NULL
  AND trim(e.point_category) = pc.id::text;
