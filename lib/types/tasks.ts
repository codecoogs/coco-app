/**
 * Types for the officer task boards (public.task_*).
 * See supabase/migrations/20260911000000_task_system.sql for the source of truth.
 */

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type TaskBoard = {
  id: string;
  branch_id: number | null;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type TaskColumn = {
  id: string;
  board_id: string;
  name: string;
  order_index: number;
  is_done_column: boolean;
};

export type TaskPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type TaskLabel = {
  id: string;
  board_id: string;
  name: string;
  color: string;
};

export type TaskCard = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_at: string | null;
  order_index: number;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  assignees: TaskPerson[];
  labels: TaskLabel[];
  checklist_total: number;
  checklist_done: number;
  comment_count: number;
};

export type TaskChecklistItem = {
  id: string;
  task_id: string;
  content: string;
  is_done: boolean;
  order_index: number;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author: TaskPerson | null;
  body: string;
  created_at: string;
};

export type TaskActivityEntry = {
  id: string;
  task_id: string;
  actor: TaskPerson | null;
  kind: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type TaskDetail = {
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
  activity: TaskActivityEntry[];
};

/** Someone the signed-in user is allowed to put on a task. */
export type AssignableUser = TaskPerson & { position_title: string | null };

export type BoardSnapshot = {
  board: TaskBoard;
  columns: TaskColumn[];
  cards: TaskCard[];
  labels: TaskLabel[];
};

/** A task assigned to me, with enough context to show where it lives. */
export type MyTaskRow = TaskCard & {
  board_name: string;
  column_name: string;
};
