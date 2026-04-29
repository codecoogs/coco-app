"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";

export type TicketManageRow = {
  id: string;
  title: string;
  status: string;
  category: string;
  priority: string;
  created_on: string | null;
  updated_on: string | null;
  is_active: boolean;
  created_by: string;
  submitter_name: string;
};

export async function getTicketsForManage(): Promise<{
  data: TicketManageRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { data: [], error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasAnyPermission(profile, ["view_tickets", "manage_tickets"])) {
    return { data: [], error: "You do not have permission to view tickets." };
  }

  const admin = getServiceRoleClient();
  if (!admin) return { data: [], error: "Missing service role key." };

  const { data: ticketRows, error: ticketErr } = await admin
    .from("tickets")
    .select(
      "id, title, status, category, priority, created_on, updated_on, is_active, created_by"
    )
    .order("created_on", { ascending: false });

  if (ticketErr) return { data: [], error: ticketErr.message };

  const list = (ticketRows ?? []) as Array<Record<string, unknown>>;
  const ids = Array.from(new Set(list.map((r) => String(r.created_by))));
  if (ids.length === 0) return { data: [], error: null };

  const { data: userRows, error: userErr } = await admin
    .from("users")
    .select("id, first_name, last_name")
    .in("id", ids);

  if (userErr) return { data: [], error: userErr.message };

  type UserRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };

  const userById = new Map<
    string,
    { first_name: string | null; last_name: string | null }
  >(
    ((userRows ?? []) as UserRow[]).map((u) => [
      String(u.id),
      { first_name: u.first_name ?? null, last_name: u.last_name ?? null },
    ])
  );

  const rows = list.map((r) => {
    const submitterId = String(r.created_by);
    const u = userById.get(submitterId);
    const submitter_name = u
      ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Unknown"
      : "Unknown";
    return {
      id: String(r.id),
      title: String(r.title ?? ""),
      status: String(r.status ?? ""),
      category: String(r.category ?? "general"),
      priority: String(r.priority ?? "normal"),
      created_on: (r.created_on as string | null) ?? null,
      updated_on: (r.updated_on as string | null) ?? null,
      is_active: Boolean(r.is_active),
      created_by: submitterId,
      submitter_name,
    } satisfies TicketManageRow;
  });

  return { data: rows, error: null };
}

export type UpdateTicketStatusInput = {
  ticketId: string;
  status: string;
};

export async function updateTicketStatusForManage(
  input: UpdateTicketStatusInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) return { error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, authUser.id);
  if (!hasPermission(profile, "manage_tickets")) {
    return { error: "You do not have permission to manage tickets." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const status = input.status.trim();
  if (!status) return { error: "Status is required." };
  if (status.length > 40) return { error: "Status is too long (max 40)." };

  const { error } = await supabase
    .from("tickets")
    .update({
      status,
      updated_by: appUserId,
    })
    .eq("id", input.ticketId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/ticket-management");
  revalidatePath("/dashboard/tickets");
  return { error: null };
}

