import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-slate-600 dark:text-zinc-300">
          Welcome back. You’re signed in and can use the app.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Your account
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Email
            </dt>
            <dd className="mt-0.5 text-slate-900 dark:text-white">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Signed in at
            </dt>
            <dd className="mt-0.5 text-slate-900 dark:text-white">
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
