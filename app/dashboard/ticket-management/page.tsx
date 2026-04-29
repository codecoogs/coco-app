import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { TicketManagementContent } from "./TicketManagementContent";
import { getTicketsForManage, updateTicketStatusForManage } from "./actions";

export default async function TicketManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/ticket-management");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasAnyPermission(profile, ["manage_tickets"])) {
    redirect("/dashboard");
  }

  const canManageTickets = hasPermission(profile, "manage_tickets");

  const ticketsRes = await getTicketsForManage();

  return (
    <div className="space-y-6">
      <TicketManagementContent
        initialTickets={ticketsRes.data}
        canManageTickets={canManageTickets}
        loadError={ticketsRes.error}
        onUpdateStatus={updateTicketStatusForManage}
      />
    </div>
  );
}

