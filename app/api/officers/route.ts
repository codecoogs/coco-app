import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { NextResponse } from "next/server";

/** Role name in public.roles for officer positions. */
const OFFICER_ROLE_NAME = "Officer";

export type OfficerAssignment = {
  id: string;
  user_id: string;
  positionTitle: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
};

/**
 * GET /api/officers
 * Returns only user_positions whose position is linked to the Officer role
 * (positions.role_id → roles where roles.name = 'Officer').
 * Requires view_officers permission.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "view_officers")) {
    return NextResponse.json(
      { error: "You do not have permission to view officers." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { data: officerRole } = await admin
    .from("roles")
    .select("id")
    .ilike("name", OFFICER_ROLE_NAME)
    .limit(1)
    .maybeSingle();

  if (!officerRole?.id) {
    return NextResponse.json({ officers: [] });
  }

  const { data: officerPositions } = await admin
    .from("positions")
    .select("title")
    .eq("role_id", officerRole.id);

  const officerTitles = (officerPositions ?? []).map((p) => p.title).filter(Boolean);
  if (officerTitles.length === 0) {
    return NextResponse.json({ officers: [] });
  }

  const { data: rows, error } = await admin
    .from("user_positions")
    .select(
      "id, user_id, positionTitle, is_active, created_at, updated_at, created_by, updated_by"
    )
    .in("positionTitle", officerTitles)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({ officers: [] });
  }

  const userIds = [...new Set((rows as { user_id: string }[]).map((r) => r.user_id))];
  const { data: users } = await admin
    .from("users")
    .select("id, email, first_name, last_name")
    .in("id", userIds);

  const userMap = new Map(
    (users ?? []).map((u) => [
      u.id,
      {
        email: u.email ?? null,
        first_name: u.first_name ?? null,
        last_name: u.last_name ?? null,
      },
    ])
  );

  const officers: OfficerAssignment[] = (rows as OfficerAssignment[]).map((r) => {
    const u = userMap.get(r.user_id);
    return {
      ...r,
      user_email: u?.email ?? null,
      user_first_name: u?.first_name ?? null,
      user_last_name: u?.last_name ?? null,
    };
  });

  return NextResponse.json({ officers });
}
