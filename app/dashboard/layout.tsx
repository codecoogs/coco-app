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
    <ProfileProvider initialUser={user}>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
        <DashboardSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardNavbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ProfileProvider>
  );
}
