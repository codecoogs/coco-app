import { ProfileProvider } from "@/app/contexts/ProfileContext";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "./components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <ProfileProvider initialUser={user}>
      <DashboardShell>{children}</DashboardShell>
    </ProfileProvider>
  );
}
