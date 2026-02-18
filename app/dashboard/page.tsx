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
        <h1 className="text-2xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back. You’re signed in and can use the app.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">
          Your account
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Email
            </dt>
            <dd className="mt-0.5 text-card-foreground">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Signed in at
            </dt>
            <dd className="mt-0.5 text-card-foreground">
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
