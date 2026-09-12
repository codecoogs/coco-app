import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/types/rbac";
import { redirect } from "next/navigation";
import { getAssignableUsers, getBoards, getBoardSnapshot, getMyTasks } from "./actions";
import { TasksPageContent } from "./TasksPageContent";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/dashboard/tasks");
  }

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasAnyPermission(profile, ["view_tasks", "manage_tasks"])) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(profile, "manage_tasks");

  const [boardsRes, assignablesRes, myTasksRes] = await Promise.all([
    getBoards(),
    getAssignableUsers(),
    getMyTasks(),
  ]);

  const firstBoard = boardsRes.data[0] ?? null;
  const snapshotRes = firstBoard
    ? await getBoardSnapshot(firstBoard.id)
    : { data: null, error: null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
        <p className="mt-1 text-muted-foreground">
          Boards for each branch. Drag a card to move it, and open one to set who is on it.
        </p>
      </div>

      <TasksPageContent
        canManage={canManage}
        boards={boardsRes.data}
        initialSnapshot={snapshotRes.data}
        initialMyTasks={myTasksRes.data}
        assignableUsers={assignablesRes.data}
        loadError={boardsRes.error ?? snapshotRes.error}
      />
    </div>
  );
}
