"use server";

import { rankBetween, RANK_STEP } from "@/lib/tasks/rank";
import { getCurrentAppUserId } from "@/lib/supabase/get-current-app-user";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type PermissionName } from "@/lib/types/rbac";
import type {
  AssignableUser,
  BoardSnapshot,
  MyTaskRow,
  TaskBoard,
  TaskCard,
  TaskChecklistItem,
  TaskColumn,
  TaskComment,
  TaskDetail,
  TaskLabel,
  TaskPerson,
  TaskPriority,
} from "@/lib/types/tasks";
import { revalidatePath } from "next/cache";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TASKS_PATH = "/dashboard/tasks";

async function requireTaskPermission(permission: PermissionName): Promise<
  | { ok: true; supabase: ServerSupabaseClient; appUserId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const profile = await fetchUserProfile(supabase, user.id);
  if (!hasPermission(profile, permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }

  const appUserId = await getCurrentAppUserId(supabase);
  if (!appUserId) return { ok: false, error: "No profile row for this user." };

  return { ok: true, supabase, appUserId };
}

const requireViewTasks = () => requireTaskPermission("view_tasks");
const requireManageTasks = () => requireTaskPermission("manage_tasks");

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function personFrom(row: PersonRow | PersonRow[] | null): TaskPerson | null {
  const person = Array.isArray(row) ? row[0] : row;
  if (!person) return null;
  return {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    email: person.email,
  };
}

/**
 * Appends to the task's trail. Never fails the caller: losing a log line is
 * not a reason to fail the move or the assignment the officer just made.
 */
async function logActivity(
  supabase: ServerSupabaseClient,
  taskId: string,
  actorId: string,
  kind: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("task_activity").insert({
    task_id: taskId,
    actor_id: actorId,
    kind,
    detail,
  });
}

export async function getBoards(): Promise<{ data: TaskBoard[]; error: string | null }> {
  const gate = await requireViewTasks();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data, error } = await gate.supabase
    .from("task_boards")
    .select("id, branch_id, name, description, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as TaskBoard[], error: null };
}

/**
 * Everything one board needs in a single round trip. RLS decides what comes
 * back, so a board the officer cannot see simply yields nothing.
 */
export async function getBoardSnapshot(
  boardId: string
): Promise<{ data: BoardSnapshot | null; error: string | null }> {
  const gate = await requireViewTasks();
  if (!gate.ok) return { data: null, error: gate.error };
  const { supabase } = gate;

  const [boardRes, columnsRes, itemsRes, labelsRes] = await Promise.all([
    supabase
      .from("task_boards")
      .select("id, branch_id, name, description, is_active")
      .eq("id", boardId)
      .maybeSingle(),
    supabase
      .from("task_columns")
      .select("id, board_id, name, order_index, is_done_column")
      .eq("board_id", boardId)
      .order("order_index", { ascending: true }),
    supabase
      .from("task_items")
      .select(
        "id, board_id, column_id, title, description, priority, due_at, order_index, completed_at, created_by, created_at"
      )
      .eq("board_id", boardId)
      .order("order_index", { ascending: true }),
    supabase
      .from("task_labels")
      .select("id, board_id, name, color")
      .eq("board_id", boardId)
      .order("name", { ascending: true }),
  ]);

  const failure = boardRes.error ?? columnsRes.error ?? itemsRes.error ?? labelsRes.error;
  if (failure) return { data: null, error: failure.message };
  if (!boardRes.data) return { data: null, error: "Board not found." };

  const items = (itemsRes.data ?? []) as Omit<
    TaskCard,
    "assignees" | "labels" | "checklist_total" | "checklist_done" | "comment_count"
  >[];
  const taskIds = items.map((i) => i.id);

  const [assigneeRes, itemLabelRes, checklistRes, commentRes] = await Promise.all([
    taskIds.length
      ? supabase
          .from("task_assignees")
          .select("task_id, users!task_assignees_user_id_fkey (id, first_name, last_name, email)")
          .in("task_id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length
      ? supabase.from("task_item_labels").select("task_id, label_id").in("task_id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length
      ? supabase.from("task_checklist_items").select("task_id, is_done").in("task_id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length
      ? supabase.from("task_comments").select("task_id").in("task_id", taskIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const labels = (labelsRes.data ?? []) as TaskLabel[];
  const labelById = new Map(labels.map((l) => [l.id, l]));

  const assigneesByTask = new Map<string, TaskPerson[]>();
  for (const row of (assigneeRes.data ?? []) as {
    task_id: string;
    users: PersonRow | PersonRow[] | null;
  }[]) {
    const person = personFrom(row.users);
    if (!person) continue;
    const list = assigneesByTask.get(row.task_id) ?? [];
    list.push(person);
    assigneesByTask.set(row.task_id, list);
  }

  const labelsByTask = new Map<string, TaskLabel[]>();
  for (const row of (itemLabelRes.data ?? []) as { task_id: string; label_id: string }[]) {
    const label = labelById.get(row.label_id);
    if (!label) continue;
    const list = labelsByTask.get(row.task_id) ?? [];
    list.push(label);
    labelsByTask.set(row.task_id, list);
  }

  const checklistByTask = new Map<string, { total: number; done: number }>();
  for (const row of (checklistRes.data ?? []) as { task_id: string; is_done: boolean }[]) {
    const counts = checklistByTask.get(row.task_id) ?? { total: 0, done: 0 };
    counts.total += 1;
    if (row.is_done) counts.done += 1;
    checklistByTask.set(row.task_id, counts);
  }

  const commentsByTask = new Map<string, number>();
  for (const row of (commentRes.data ?? []) as { task_id: string }[]) {
    commentsByTask.set(row.task_id, (commentsByTask.get(row.task_id) ?? 0) + 1);
  }

  const cards: TaskCard[] = items.map((item) => {
    const counts = checklistByTask.get(item.id) ?? { total: 0, done: 0 };
    return {
      ...item,
      assignees: assigneesByTask.get(item.id) ?? [],
      labels: labelsByTask.get(item.id) ?? [],
      checklist_total: counts.total,
      checklist_done: counts.done,
      comment_count: commentsByTask.get(item.id) ?? 0,
    };
  });

  return {
    data: {
      board: boardRes.data as TaskBoard,
      columns: (columnsRes.data ?? []) as TaskColumn[],
      cards,
      labels,
    },
    error: null,
  };
}

/** Everything assigned to me, across every board I can see. */
export async function getMyTasks(): Promise<{ data: MyTaskRow[]; error: string | null }> {
  const gate = await requireViewTasks();
  if (!gate.ok) return { data: [], error: gate.error };
  const { supabase, appUserId } = gate;

  const { data: mine, error: mineError } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", appUserId);
  if (mineError) return { data: [], error: mineError.message };

  const taskIds = (mine ?? []).map((row) => row.task_id as string);
  if (!taskIds.length) return { data: [], error: null };

  const { data, error } = await supabase
    .from("task_items")
    .select(
      "id, board_id, column_id, title, description, priority, due_at, order_index, completed_at, created_by, created_at, task_boards (name), task_columns!task_items_column_board_fkey (name)"
    )
    .in("id", taskIds)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  type Row = Omit<
    TaskCard,
    "assignees" | "labels" | "checklist_total" | "checklist_done" | "comment_count"
  > & {
    task_boards: { name: string } | { name: string }[] | null;
    task_columns: { name: string } | { name: string }[] | null;
  };

  const rows: MyTaskRow[] = ((data ?? []) as Row[]).map((row) => {
    const board = Array.isArray(row.task_boards) ? row.task_boards[0] : row.task_boards;
    const column = Array.isArray(row.task_columns) ? row.task_columns[0] : row.task_columns;
    return {
      id: row.id,
      board_id: row.board_id,
      column_id: row.column_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      due_at: row.due_at,
      order_index: row.order_index,
      completed_at: row.completed_at,
      created_by: row.created_by,
      created_at: row.created_at,
      assignees: [],
      labels: [],
      checklist_total: 0,
      checklist_done: 0,
      comment_count: 0,
      board_name: board?.name ?? "",
      column_name: column?.name ?? "",
    };
  });

  return { data: rows, error: null };
}

/** Who this officer may put on a task: themselves and anyone below them. */
export async function getAssignableUsers(): Promise<{
  data: AssignableUser[];
  error: string | null;
}> {
  const gate = await requireViewTasks();
  if (!gate.ok) return { data: [], error: gate.error };

  const { data, error } = await gate.supabase.rpc("assignable_users");
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as AssignableUser[], error: null };
}

export async function getTaskDetail(
  taskId: string
): Promise<{ data: TaskDetail | null; error: string | null }> {
  const gate = await requireViewTasks();
  if (!gate.ok) return { data: null, error: gate.error };
  const { supabase } = gate;

  const [checklistRes, commentRes, activityRes] = await Promise.all([
    supabase
      .from("task_checklist_items")
      .select("id, task_id, content, is_done, order_index")
      .eq("task_id", taskId)
      .order("order_index", { ascending: true }),
    supabase
      .from("task_comments")
      .select("id, task_id, body, created_at, users!task_comments_author_id_fkey (id, first_name, last_name, email)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_activity")
      .select("id, task_id, kind, detail, created_at, users!task_activity_actor_id_fkey (id, first_name, last_name, email)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const failure = checklistRes.error ?? commentRes.error ?? activityRes.error;
  if (failure) return { data: null, error: failure.message };

  const comments: TaskComment[] = (
    (commentRes.data ?? []) as {
      id: string;
      task_id: string;
      body: string;
      created_at: string;
      users: PersonRow | PersonRow[] | null;
    }[]
  ).map((row) => ({
    id: row.id,
    task_id: row.task_id,
    body: row.body,
    created_at: row.created_at,
    author: personFrom(row.users),
  }));

  const activity = (
    (activityRes.data ?? []) as {
      id: string;
      task_id: string;
      kind: string;
      detail: Record<string, unknown> | null;
      created_at: string;
      users: PersonRow | PersonRow[] | null;
    }[]
  ).map((row) => ({
    id: row.id,
    task_id: row.task_id,
    kind: row.kind,
    detail: row.detail ?? {},
    created_at: row.created_at,
    actor: personFrom(row.users),
  }));

  return {
    data: {
      checklist: (checklistRes.data ?? []) as TaskChecklistItem[],
      comments,
      activity,
    },
    error: null,
  };
}

export type CreateTaskInput = {
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueAt: string | null;
  assigneeIds: string[];
  labelIds: string[];
};

export async function createTask(
  input: CreateTaskInput
): Promise<{ id: string | null; error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { id: null, error: gate.error };
  const { supabase, appUserId } = gate;

  if (!input.title.trim()) return { id: null, error: "Give the task a title." };

  const { data: last } = await supabase
    .from("task_items")
    .select("order_index")
    .eq("column_id", input.columnId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("task_items")
    .insert({
      board_id: input.boardId,
      column_id: input.columnId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority,
      due_at: input.dueAt,
      order_index: last ? last.order_index + RANK_STEP : RANK_STEP,
      created_by: appUserId,
      updated_by: appUserId,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };

  if (input.assigneeIds.length) {
    const { error: assignError } = await supabase.from("task_assignees").insert(
      input.assigneeIds.map((userId) => ({
        task_id: created.id,
        user_id: userId,
        assigned_by: appUserId,
      }))
    );
    // The row-level policy refuses anyone outside this officer's chain of
    // command, so say that plainly rather than leaking the Postgres error.
    if (assignError) {
      return { id: created.id, error: "The task was created, but you cannot assign it to that person." };
    }
  }

  if (input.labelIds.length) {
    await supabase
      .from("task_item_labels")
      .insert(input.labelIds.map((labelId) => ({ task_id: created.id, label_id: labelId })));
  }

  await logActivity(supabase, created.id, appUserId, "created", { title: input.title.trim() });
  revalidatePath(TASKS_PATH);
  return { id: created.id, error: null };
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    dueAt?: string | null;
  }
): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };
  const { supabase, appUserId } = gate;

  const update: Record<string, unknown> = { updated_by: appUserId };
  if (patch.title !== undefined) {
    if (!patch.title.trim()) return { error: "Give the task a title." };
    update.title = patch.title.trim();
  }
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;

  const { error } = await supabase.from("task_items").update(update).eq("id", taskId);
  if (error) return { error: error.message };

  await logActivity(supabase, taskId, appUserId, "updated", { fields: Object.keys(patch) });
  revalidatePath(TASKS_PATH);
  return { error: null };
}

/**
 * A drop writes one row: the card lands between the ranks of the cards it was
 * dropped between. Landing in a "done" column stamps completed_at, which is
 * what the weekly digest and the board's done styling read.
 */
export async function moveTask(input: {
  taskId: string;
  columnId: string;
  beforeRank: number | null;
  afterRank: number | null;
}): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };
  const { supabase, appUserId } = gate;

  const { data: column, error: columnError } = await supabase
    .from("task_columns")
    .select("id, name, is_done_column")
    .eq("id", input.columnId)
    .maybeSingle();
  if (columnError) return { error: columnError.message };
  if (!column) return { error: "That column no longer exists." };

  const { error } = await supabase
    .from("task_items")
    .update({
      column_id: input.columnId,
      order_index: rankBetween(input.beforeRank, input.afterRank),
      completed_at: column.is_done_column ? new Date().toISOString() : null,
      updated_by: appUserId,
    })
    .eq("id", input.taskId);

  if (error) return { error: error.message };

  await logActivity(supabase, input.taskId, appUserId, "moved", { column: column.name });
  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function deleteTask(taskId: string): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("task_items").delete().eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function addAssignee(
  taskId: string,
  userId: string
): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };
  const { supabase, appUserId } = gate;

  const { error } = await supabase
    .from("task_assignees")
    .insert({ task_id: taskId, user_id: userId, assigned_by: appUserId });

  if (error) {
    return { error: "You can only assign work to yourself or to someone who reports to you." };
  }

  await logActivity(supabase, taskId, appUserId, "assigned", { user_id: userId });
  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function removeAssignee(
  taskId: string,
  userId: string
): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };
  const { supabase, appUserId } = gate;

  const { error } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  await logActivity(supabase, taskId, appUserId, "unassigned", { user_id: userId });
  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function addComment(
  taskId: string,
  body: string
): Promise<{ error: string | null }> {
  const gate = await requireViewTasks();
  if (!gate.ok) return { error: gate.error };
  const { supabase, appUserId } = gate;

  if (!body.trim()) return { error: "Write something first." };

  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: appUserId, body: body.trim() });

  if (error) return { error: error.message };

  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function addChecklistItem(
  taskId: string,
  content: string
): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };
  const { supabase, appUserId } = gate;

  if (!content.trim()) return { error: "Write the subtask first." };

  const { data: last } = await supabase
    .from("task_checklist_items")
    .select("order_index")
    .eq("task_id", taskId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("task_checklist_items").insert({
    task_id: taskId,
    content: content.trim(),
    order_index: last ? last.order_index + 1 : 0,
    created_by: appUserId,
    updated_by: appUserId,
  });

  if (error) return { error: error.message };

  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function setChecklistItemDone(
  itemId: string,
  isDone: boolean
): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("task_checklist_items")
    .update({ is_done: isDone, updated_by: gate.appUserId })
    .eq("id", itemId);

  if (error) return { error: error.message };

  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function deleteChecklistItem(itemId: string): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("task_checklist_items").delete().eq("id", itemId);
  if (error) return { error: error.message };

  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function createColumn(
  boardId: string,
  name: string
): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };
  const { supabase, appUserId } = gate;

  if (!name.trim()) return { error: "Name the column first." };

  const { data: last } = await supabase
    .from("task_columns")
    .select("order_index")
    .eq("board_id", boardId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("task_columns").insert({
    board_id: boardId,
    name: name.trim(),
    order_index: last ? last.order_index + 1 : 0,
    created_by: appUserId,
    updated_by: appUserId,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "That column already exists on this board." : error.message,
    };
  }

  revalidatePath(TASKS_PATH);
  return { error: null };
}

export async function renameColumn(
  columnId: string,
  name: string
): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };

  if (!name.trim()) return { error: "Name the column first." };

  const { error } = await gate.supabase
    .from("task_columns")
    .update({ name: name.trim(), updated_by: gate.appUserId })
    .eq("id", columnId);

  if (error) {
    return {
      error: error.code === "23505" ? "That column already exists on this board." : error.message,
    };
  }

  revalidatePath(TASKS_PATH);
  return { error: null };
}

/** Deleting a column with cards on it is refused by the foreign key, on purpose. */
export async function deleteColumn(columnId: string): Promise<{ error: string | null }> {
  const gate = await requireManageTasks();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("task_columns").delete().eq("id", columnId);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Move the tasks out of this column before deleting it."
          : error.message,
    };
  }

  revalidatePath(TASKS_PATH);
  return { error: null };
}
