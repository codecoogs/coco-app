"use client";

import { Badge } from "@/app/components/ui/shadcn/badge";
import { Button } from "@/app/components/ui/shadcn/button";
import { Input } from "@/app/components/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/shadcn/select";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/shadcn/tabs";
import { createClient } from "@/lib/supabase/client";
import { rankBetween } from "@/lib/tasks/rank";
import type {
  AssignableUser,
  BoardSnapshot,
  MyTaskRow,
  TaskBoard,
  TaskCard,
  TaskColumn,
} from "@/lib/types/tasks";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createColumn, getBoardSnapshot, getMyTasks, moveTask } from "./actions";
import { personName, TaskDetailModal } from "./TaskDetailModal";

/** The board is live, but a dropped socket should not leave it stale. */
const POLL_INTERVAL_MS = 60_000;

const PRIORITY_TONE: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-amber-700 dark:text-amber-400",
  urgent: "text-red-700 dark:text-red-400",
};

type Props = {
  canManage: boolean;
  boards: TaskBoard[];
  initialSnapshot: BoardSnapshot | null;
  initialMyTasks: MyTaskRow[];
  assignableUsers: AssignableUser[];
  loadError: string | null;
};

function DraggableCard({
  card,
  canManage,
  onOpen,
}: {
  card: TaskCard;
  canManage: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !canManage,
  });

  const overdue = card.due_at && !card.completed_at && isPast(parseISO(card.due_at));

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-border bg-card p-3 shadow-sm ${
        isDragging ? "opacity-50" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left text-sm font-medium text-card-foreground hover:underline"
      >
        {card.title}
      </button>

      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <Badge key={label.id} variant="outline" className="text-[10px]">
              {label.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={PRIORITY_TONE[card.priority]}>{card.priority}</span>
        {card.due_at && (
          <span className={overdue ? "text-red-700 dark:text-red-400" : ""}>
            due {format(parseISO(card.due_at), "MMM d")}
          </span>
        )}
        {card.checklist_total > 0 && (
          <span>
            {card.checklist_done}/{card.checklist_total}
          </span>
        )}
        {card.comment_count > 0 && <span>{card.comment_count} comments</span>}
      </div>

      {card.assignees.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.assignees.map((person) => (
            <span
              key={person.id}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {personName(person)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardColumn({
  column,
  cards,
  canManage,
  onAddTask,
  onOpenTask,
}: {
  column: TaskColumn;
  cards: TaskCard[];
  canManage: boolean;
  onAddTask: () => void;
  onOpenTask: (card: TaskCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">
          {column.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{cards.length}</span>
        </h3>
        {canManage && (
          <button
            type="button"
            onClick={onAddTask}
            aria-label={`Add a task to ${column.name}`}
            className="text-lg leading-none text-muted-foreground hover:text-foreground"
          >
            +
          </button>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2 p-2 ${isOver ? "bg-muted/60" : ""}`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              canManage={canManage}
              onOpen={() => onOpenTask(card)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nothing here yet.</p>
        )}
      </div>
    </section>
  );
}

export function TasksPageContent({
  canManage,
  boards,
  initialSnapshot,
  initialMyTasks,
  assignableUsers,
  loadError,
}: Props) {
  const [view, setView] = useState<"board" | "mine">("board");
  const [boardId, setBoardId] = useState(initialSnapshot?.board.id ?? boards[0]?.id ?? "");
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(initialSnapshot);
  const [myTasks, setMyTasks] = useState<MyTaskRow[]>(initialMyTasks);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    loadError ? { type: "error", text: loadError } : null
  );
  const [modal, setModal] = useState<
    { mode: "create"; columnId: string } | { mode: "edit"; card: TaskCard } | null
  >(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [, startBoardLoad] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const refreshBoard = useCallback(async () => {
    if (!boardId) return;
    const res = await getBoardSnapshot(boardId);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setSnapshot(res.data);
  }, [boardId]);

  const refreshMyTasks = useCallback(async () => {
    const res = await getMyTasks();
    if (!res.error) setMyTasks(res.data);
  }, []);

  useEffect(() => {
    startBoardLoad(async () => {
      await refreshBoard();
    });
  }, [refreshBoard]);

  // Live board: any write to the task tables pulls a fresh snapshot. Refetching
  // rather than patching the local state keeps RLS the single source of truth
  // for what this officer is allowed to see.
  useEffect(() => {
    if (!boardId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`task-board-${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_items" }, () => {
        void refreshBoard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_columns" }, () => {
        void refreshBoard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, () => {
        void refreshBoard();
        void refreshMyTasks();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_checklist_items" }, () => {
        void refreshBoard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, () => {
        void refreshBoard();
      })
      .subscribe();

    const interval = setInterval(() => {
      void refreshBoard();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [boardId, refreshBoard, refreshMyTasks]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, TaskCard[]>();
    for (const column of snapshot?.columns ?? []) map.set(column.id, []);
    for (const card of snapshot?.cards ?? []) {
      const list = map.get(card.column_id) ?? [];
      list.push(card);
      map.set(card.column_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order_index - b.order_index);
    return map;
  }, [snapshot]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !snapshot) return;

      const card = snapshot.cards.find((c) => c.id === active.id);
      if (!card) return;

      // Dropping on a column drops at its end; dropping on a card drops next to it.
      const overColumn = snapshot.columns.find((c) => c.id === over.id);
      const overCard = snapshot.cards.find((c) => c.id === over.id);
      const targetColumnId = overColumn?.id ?? overCard?.column_id;
      if (!targetColumnId) return;

      const siblings = (cardsByColumn.get(targetColumnId) ?? []).filter((c) => c.id !== card.id);
      let beforeRank: number | null = null;
      let afterRank: number | null = null;

      if (overCard && overCard.id !== card.id) {
        const index = siblings.findIndex((c) => c.id === overCard.id);
        if (index >= 0) {
          beforeRank = index === 0 ? null : siblings[index - 1].order_index;
          afterRank = siblings[index].order_index;
        }
      } else {
        beforeRank = siblings.length ? siblings[siblings.length - 1].order_index : null;
      }

      if (targetColumnId === card.column_id && beforeRank === null && afterRank === null) return;

      const nextRank = rankBetween(beforeRank, afterRank);
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              cards: prev.cards.map((c) =>
                c.id === card.id ? { ...c, column_id: targetColumnId, order_index: nextRank } : c
              ),
            }
          : prev
      );

      const res = await moveTask({ taskId: card.id, columnId: targetColumnId, beforeRank, afterRank });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        void refreshBoard();
      }
    },
    [snapshot, cardsByColumn, refreshBoard]
  );

  async function handleAddColumn() {
    if (!newColumnName.trim() || !boardId) return;
    setAddingColumn(true);
    const res = await createColumn(boardId, newColumnName);
    setAddingColumn(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setNewColumnName("");
    await refreshBoard();
  }

  if (!boards.length) {
    return (
      <p className="text-muted-foreground">
        You do not have a board yet. A VP or the President can create one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={
            message.type === "error"
              ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
          }
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="mine">My tasks</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "board" && boards.length > 1 && (
          <Select value={boardId} onValueChange={(v) => v && setBoardId(v as string)}>
            <SelectTrigger className="w-56">
              <SelectValue>
                {(v: string) => boards.find((b) => b.id === v)?.name ?? "Board"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {boards.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {view === "board" && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {(snapshot?.columns ?? []).map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={cardsByColumn.get(column.id) ?? []}
                canManage={canManage}
                onAddTask={() => setModal({ mode: "create", columnId: column.id })}
                onOpenTask={(card) => setModal({ mode: "edit", card })}
              />
            ))}

            {canManage && (
              <div className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-dashed border-border p-3">
                <Input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="New column, e.g. Blocked"
                />
                <Button variant="outline" onClick={handleAddColumn} disabled={addingColumn}>
                  {addingColumn ? "Adding…" : "Add column"}
                </Button>
              </div>
            )}
          </div>
        </DndContext>
      )}

      {view === "mine" && (
        <div className="rounded-xl border border-border">
          {myTasks.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing is assigned to you right now.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {myTasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="flex-1 text-sm font-medium text-foreground">{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.board_name} · {task.column_name}
                  </span>
                  {task.due_at && (
                    <span
                      className={`text-xs ${
                        !task.completed_at && isPast(parseISO(task.due_at))
                          ? "text-red-700 dark:text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      due {format(parseISO(task.due_at), "MMM d")}
                    </span>
                  )}
                  <span className={`text-xs ${PRIORITY_TONE[task.priority]}`}>{task.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal && snapshot && (
        <TaskDetailModal
          mode={modal.mode}
          boardId={snapshot.board.id}
          columnId={modal.mode === "create" ? modal.columnId : modal.card.column_id}
          task={modal.mode === "edit" ? modal.card : null}
          labels={snapshot.labels}
          assignableUsers={assignableUsers}
          canManage={canManage}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await Promise.all([refreshBoard(), refreshMyTasks()]);
          }}
        />
      )}
    </div>
  );
}
