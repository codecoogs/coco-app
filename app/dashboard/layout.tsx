import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "./components/DashboardSidebar";
import { redirect } from "next/navigation";

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
    <div className="flex min-h-screen bg-slate-50">
      <DashboardSidebar />

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end border-b border-zinc-200 bg-white px-4 sm:px-6">
          <nav className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">{user.email}</span>
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Sign out
              </button>
            </form>
          </nav>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
