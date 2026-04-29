import { createClient } from "@/lib/supabase/server";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { TicketsContent } from "./TicketsContent";
import { createTicket, getMyTickets } from "./actions";

export default async function TicketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/tickets");
  }

  const [profile, ticketsRes] = await Promise.all([
    fetchUserProfile(supabase, user.id),
    getMyTickets(),
  ]);

  const canManageTickets = hasPermission(profile, "manage_tickets");

  return (
    <div className="space-y-8">
      <TicketsContent
        initialTickets={ticketsRes.data}
        canManageTickets={canManageTickets}
        loadError={ticketsRes.error}
        onCreateTicket={createTicket}
      />
    </div>
  );
}

