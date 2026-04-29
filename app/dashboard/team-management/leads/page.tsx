import { redirect } from "next/navigation";

/** Legacy route: unified Team management page with Team leads tab (?tab=leads). */
export default function TeamManagementLeadsRedirectPage() {
  redirect("/dashboard/team-management?tab=leads");
}
