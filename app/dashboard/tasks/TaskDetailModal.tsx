"use client";

import { Badge } from "@/app/components/ui/shadcn/badge";
import { Button } from "@/app/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/shadcn/dialog";
import { Input } from "@/app/components/ui/shadcn/input";
import { Label } from "@/app/components/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/shadcn/select";
import { Textarea } from "@/app/components/ui/shadcn/textarea";
import {
  TASK_PRIORITIES,
  type AssignableUser,
  type TaskCard,
  type TaskDetail,
  type TaskLabel,
  type TaskPerson,
  type TaskPriority,
} from "@/lib/types/tasks";
import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  addAssignee,
  addChecklistItem,
  addComment,
  createTask,
  deleteChecklistItem,
  deleteTask,
  getTaskDetail,
  removeAssignee,
  setChecklistItemDone,
  updateTask,
} from "./actions";

export function personName(person: TaskPerson | AssignableUser | null): string {
  if (!person) return "Someone";
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name || person.email || "Someone";
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

type Props = {
  mode: "create" | "edit";
  boardId: string;
  columnId: string;
  task: TaskCard | null;
  labels: TaskLabel[];
  assignableUsers: AssignableUser[];
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function TaskDetailModal({
  mode,
  boardId,
  columnId,
  task,
  labels,
  assignableUsers,
  canManage,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.due_at ?? null));
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [pendingAssigneeIds, setPendingAssigneeIds] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    (task?.labels ?? []).map((l) => l.id)
  );
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startDetailLoad] = useTransition();

  const taskId = task?.id ?? null;

  const loadDetail = useCallback(async () => {
    if (!taskId) return;
    const res = await getTaskDetail(taskId);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDetail(res.data);
  }, [taskId]);

  useEffect(() => {
    startDetailLoad(async () => {
      await loadDetail();
    });
  }, [loadDetail]);

  const assigneeIds = new Set((task?.assignees ?? []).map((a) => a.id));
  const unassigned = assignableUsers.filter((u) => !assigneeIds.has(u.id));

  async function handleSave() {
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }
    setBusy(true);
    setError(null);

    const dueAt = dueDate ? new Date(dueDate).toISOString() : null;

    if (mode === "create") {
      const res = await createTask({
        boardId,
        columnId,
        title,
        description,
        priority,
        dueAt,
        assigneeIds: pendingAssigneeIds,
        labelIds: selectedLabelIds,
      });
      setBusy(false);
      if (res.error) {
        setError(res.error);
        if (!res.id) return;
      }
      onSaved();
      return;
    }

    const res = await updateTask(task!.id, { title, description, priority, dueAt });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  async function handleAddAssignee(userId: string) {
    if (!userId) return;
    if (mode === "create") {
      setPendingAssigneeIds((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
      setNewAssigneeId("");
      return;
    }
    setBusy(true);
    const res = await addAssignee(task!.id, userId);
    setBusy(false);
    setNewAssigneeId("");
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  async function handleRemoveAssignee(userId: string) {
    if (mode === "create") {
      setPendingAssigneeIds((ids) => ids.filter((id) => id !== userId));
      return;
    }
    setBusy(true);
    const res = await removeAssignee(task!.id, userId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  async function handleAddChecklistItem() {
    if (!taskId || !newChecklistItem.trim()) return;
    setBusy(true);
    const res = await addChecklistItem(taskId, newChecklistItem);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewChecklistItem("");
    await loadDetail();
    onSaved();
  }

  async function handleToggleChecklistItem(itemId: string, isDone: boolean) {
    const res = await setChecklistItemDone(itemId, isDone);
    if (res.error) {
      setError(res.error);
      return;
    }
    await loadDetail();
    onSaved();
  }

  async function handleDeleteChecklistItem(itemId: string) {
    const res = await deleteChecklistItem(itemId);
    if (res.error) {
      setError(res.error);
      return;
    }
    await loadDetail();
    onSaved();
  }

  async function handleAddComment() {
    if (!taskId || !newComment.trim()) return;
    setBusy(true);
    const res = await addComment(taskId, newComment);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewComment("");
    await loadDetail();
    onSaved();
  }

  async function handleDelete() {
    if (!taskId) return;
    if (!confirm("Delete this task? This cannot be undone.")) return;
    setBusy(true);
    const res = await deleteTask(taskId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  const pendingAssignees = assignableUsers.filter((u) => pendingAssigneeIds.includes(u.id));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New task" : "Task details"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Book the room for the fall workshop"
              disabled={!canManage}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={!canManage}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>

          {labels.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => {
                  const on = selectedLabelIds.includes(label.id);
                  return (
                    <Badge
                      key={label.id}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedLabelIds((ids) =>
                          on ? ids.filter((id) => id !== label.id) : [...ids, label.id]
                        )
                      }
                    >
                      {label.name}
                    </Badge>
                  );
                })}
              </div>
              {mode === "edit" && (
                <p className="text-xs text-muted-foreground">
                  Tags are set when the task is created for now.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Assignees</Label>
            <div className="flex flex-wrap gap-2">
              {(mode === "create" ? pendingAssignees : (task?.assignees ?? [])).map((person) => (
                <Badge key={person.id} variant="secondary" className="gap-2">
                  {personName(person)}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAssignee(person.id)}
                      aria-label={`Remove ${personName(person)}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
              {(mode === "create" ? pendingAssignees : (task?.assignees ?? [])).length === 0 && (
                <span className="text-sm text-muted-foreground">Nobody yet.</span>
              )}
            </div>
            {canManage && (
              <Select value={newAssigneeId} onValueChange={(v) => handleAddAssignee(v as string)}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) =>
                      v ? personName(assignableUsers.find((u) => u.id === v) ?? null) : "Add someone…"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {unassigned.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {personName(u)}
                      {u.position_title ? ` — ${u.position_title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              You can pick yourself and anyone who reports to you.
            </p>
          </div>

          {mode === "edit" && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Checklist</Label>
                {(detail?.checklist ?? []).map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_done}
                      onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)}
                      className="rounded border-border"
                    />
                    <span
                      className={
                        item.is_done
                          ? "flex-1 text-sm text-muted-foreground line-through"
                          : "flex-1 text-sm text-foreground"
                      }
                    >
                      {item.content}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteChecklistItem(item.id)}
                      aria-label="Delete subtask"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Add a subtask"
                  />
                  <Button variant="outline" onClick={handleAddChecklistItem} disabled={busy}>
                    Add
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Comments</Label>
                {(detail?.comments ?? []).map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-border p-2">
                    <p className="text-xs text-muted-foreground">
                      {personName(comment.author)} ·{" "}
                      {format(parseISO(comment.created_at), "MMM d, h:mm a")}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{comment.body}</p>
                  </div>
                ))}
                {(detail?.comments ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No comments yet. This is a good place to ask for help.
                  </p>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    placeholder="Write a comment"
                  />
                  <Button variant="outline" onClick={handleAddComment} disabled={busy}>
                    Post
                  </Button>
                </div>
              </div>

              {(detail?.activity ?? []).length > 0 && (
                <div className="flex flex-col gap-1">
                  <Label>Activity</Label>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {(detail?.activity ?? []).slice(0, 10).map((entry) => (
                      <li key={entry.id}>
                        {personName(entry.actor)} {entry.kind} ·{" "}
                        {format(parseISO(entry.created_at), "MMM d, h:mm a")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          {mode === "edit" && canManage && (
            <Button variant="outline" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canManage && (
            <Button onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : mode === "create" ? "Create task" : "Save changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
