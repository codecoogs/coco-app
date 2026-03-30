DROP POLICY IF EXISTS "point_categories_select_authenticated" ON public.point_categories;

CREATE POLICY "point_categories_select_authenticated"
  ON public.point_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional reads with the anon key (public reference data).
DROP POLICY IF EXISTS "point_categories_select_anon" ON public.point_categories;
CREATE POLICY "point_categories_select_anon"
  ON public.point_categories
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "point_categories_select_authenticated" ON public.point_categories IS
  'All signed-in users may read point category definitions (Point information page).';

COMMENT ON POLICY "point_categories_select_anon" ON public.point_categories IS
  'Anonymous clients may read point categories (e.g. public embeds).';