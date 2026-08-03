import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getFormsForRespondent } from "./actions";
import { FormsListContent } from "./FormsListContent";

export default async function FormsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    redirect("/login?next=/dashboard/forms");
  }

  const { data, error } = await getFormsForRespondent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Forms</h1>
        <p className="mt-1 text-muted-foreground">
          Applications and sign-ups open to you.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : (
        <FormsListContent forms={data} />
      )}
    </div>
  );
}
