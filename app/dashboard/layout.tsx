import { ProfileProvider } from "@/app/contexts/ProfileContext";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardNavbar } from "./components/DashboardNavbar";
import { DashboardSidebar } from "./components/DashboardSidebar";

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
    <div className="flex min-h-screen bg-slate-50 dark:bg-zinc-900">
      <DashboardSidebar />

      <div className="flex flex-1 flex-col">
        <ProfileProvider>
          <DashboardNavbar />
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </ProfileProvider>
      </div>
    </div>
  );
}
