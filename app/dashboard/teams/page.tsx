import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type TeamCard = {
  id: string;
  name: string;
  team_number: number;
  description: string | null;
  team_image_url: string | null;
  members: { id: string; name: string; email: string }[];
};

export default async function TeamsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) {
    redirect("/login?next=/dashboard/teams");
  }

  const [{ data: teamsRows, error: teamsErr }, { data: tmRows, error: tmErr }, { data: usersRows, error: usersErr }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, name, team_number, description, team_image_url")
        .order("team_number", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("teams_members").select("team_id, user_id"),
      supabase.from("users").select("id, first_name, last_name, email"),
    ]);

  const combinedError = teamsErr?.message ?? tmErr?.message ?? usersErr?.message ?? null;
  if (combinedError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
        {combinedError}
      </div>
    );
  }

  const userMap = new Map(
    (usersRows ?? []).map((u) => {
      const first = typeof u.first_name === "string" ? u.first_name.trim() : "";
      const last = typeof u.last_name === "string" ? u.last_name.trim() : "";
      const full = [first, last].filter(Boolean).join(" ");
      const email = typeof u.email === "string" ? u.email : "";
      return [String(u.id), { name: full || email || "Member", email }];
    })
  );

  const membersByTeam = new Map<string, { id: string; name: string; email: string }[]>();
  for (const row of tmRows ?? []) {
    const tid = String(row.team_id);
    const uid = String(row.user_id);
    const info = userMap.get(uid);
    if (!info) continue;
    const next = membersByTeam.get(tid) ?? [];
    next.push({ id: uid, name: info.name, email: info.email });
    membersByTeam.set(tid, next);
  }

  const cards: TeamCard[] = (teamsRows ?? []).map((t) => ({
    id: String(t.id),
    name: String(t.name ?? "Team"),
    team_number: typeof t.team_number === "number" ? t.team_number : Number(t.team_number) || 0,
    description: typeof t.description === "string" ? t.description : null,
    team_image_url: typeof t.team_image_url === "string" ? t.team_image_url : null,
    members: (membersByTeam.get(String(t.id)) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Teams</h1>
        <p className="mt-1 text-muted-foreground">
          Browse all teams, descriptions, and member rosters.
        </p>
      </div>

      {cards.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-muted-foreground">
            No teams are published yet.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {cards.map((team) => (
            <section key={team.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">{team.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {team.team_number > 0 ? `Team #${team.team_number}` : "Team number not set"}
                  </p>
                </div>
              </div>
              {team.team_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.team_image_url}
                  alt=""
                  className="mt-4 h-44 w-full rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="mt-4 flex h-44 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center text-sm text-muted-foreground">
                  No team photo uploaded yet.
                </div>
              )}
              <p className="mt-4 text-sm text-card-foreground">
                {team.description?.trim() || "No team description provided yet."}
              </p>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Members ({team.members.length})
                </p>
                {team.members.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No members assigned to this team yet.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {team.members.map((m) => (
                      <li key={m.id} className="text-sm text-card-foreground">
                        {m.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
