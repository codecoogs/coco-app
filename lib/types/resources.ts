/**
 * Types for the resources feature (public.resources).
 * See supabase/migrations/20260903130000_resources_schema.sql for the source of truth.
 */

export type Resource = {
  id: string;
  title: string;
  description: string | null;
  /** Free text — the public site builds its category tabs from the distinct values it receives. */
  category: string;
  link_url: string;
  /** File type shown under the title on the public site (e.g. "pdf", "ipynb"). */
  extension: string | null;
  thumbnail_url: string | null;
  /** Date the material is from, as "YYYY-MM-DD". Not a timestamp — no time zone. */
  resource_date: string | null;
  display_order: number;
  /** Whether this may appear on codecoogs.com. Distinct from is_active, which is whether it exists at all. */
  website_viewable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ResourceInput = {
  title: string;
  description: string | null;
  category: string;
  link_url: string;
  extension: string | null;
  resource_date: string | null;
  website_viewable: boolean;
};
