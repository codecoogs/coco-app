import type { UserProfile } from "@/lib/types/rbac";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches the current user's position title, is_admin, and permissions in a single request.
 * Uses the `user_profile` view. Create it in Supabase with:
 *
 * create or replace view user_profile as
 * select
 *   up.user_id,
 *   up."positionTitle" as "positionTitle",
 *   p.is_admin,
 *   coalesce(
 *     array_agg(perm.name) filter (where perm.id is not null),
 *     array[]::text[]
 *   ) as permissions
 * from public.user_positions up
 * join public.positions p on up."positionTitle" = p.title
 * left join public.position_permissions pp on p.id = pp.position_id
 * left join public.permissions perm on pp.permission_id = perm.id
 * group by up.user_id, up."positionTitle", p.is_admin, p.id;
 *
 * Then: alter view user_profile set (security_invoker = on);
 * (or grant select to authenticated users as needed)
 */
export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select("positionTitle, is_admin, permissions")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    positionTitle: data.positionTitle ?? "",
    is_admin: Boolean(data.is_admin),
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
}
