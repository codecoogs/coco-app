import { redirect } from "next/navigation";

/** Legacy route: use unified Team management page with Teams tab. */
export default function TeamManagementTeamsRedirectPage() {
  redirect("/dashboard/team-management");
}
