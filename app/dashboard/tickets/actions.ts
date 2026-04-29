"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";

export type TicketRow = {
  id: string;
  title: string;
  status: string;
  category: string;
  priority: string;
  created_on: string | null;
  updated_on: string | null;
  is_active: boolean;
};

export async function getMyTickets(): Promise<{
  data: TicketRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { data: [], error: "Not signed in." };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { data: [], error: "Could not resolve your user account." };

  const { data: rows, error } = await supabase
    .from("tickets")
    .select(
      "id, title, status, category, priority, created_on, updated_on, is_active"
    )
    .eq("created_by", appUserId)
    .order("created_on", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (rows ?? []) as TicketRow[], error: null };
}

export type CreateTicketInput = {
  title: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "high";
};

export async function createTicket(
  input: CreateTicketInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Not signed in." };

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { error: "Could not resolve your user account." };

  const title = input.title.trim();
  const description = input.description.trim();
  const category = input.category.trim() || "general";
  const priority = input.priority;

  if (title.length < 3) return { error: "Title must be at least 3 characters." };
  if (description.length < 10)
    return { error: "Description must be at least 10 characters." };
  if (title.length > 120) return { error: "Title is too long (max 120)." };
  if (description.length > 5000)
    return { error: "Description is too long (max 5000)." };

  const { error } = await supabase.from("tickets").insert({
    title,
    description,
    category,
    priority,
    status: "in_progress",
    created_by: appUserId,
    updated_by: appUserId,
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tickets");
  return { error: null };
}

