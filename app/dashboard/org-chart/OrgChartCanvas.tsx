"use client";

import { Button } from "@/app/components/ui/shadcn/button";
import { diffChartNodes, layoutChartNodes, wouldCreateCycle, type ChartNode } from "@/lib/org-chart/tree";
import {
  Background,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import { saveOrgChart, type OrgChartNode } from "./actions";

type Props = {
  initialNodes: OrgChartNode[];
  canEdit: boolean;
  loadError: string | null;
};

function nodeLabel(position: OrgChartNode) {
  const holders = position.holders.length ? position.holders.join(", ") : "Vacant";
  return (
    <div className="text-left">
      <div className="text-sm font-semibold text-foreground">{position.title}</div>
      <div className="text-[11px] text-muted-foreground">
        {position.branchName ?? "No branch"} · {holders}
      </div>
    </div>
  );
}

function toFlowNodes(positions: OrgChartNode[]): Node[] {
  return layoutChartNodes(positions).map((placed) => {
    const position = positions.find((p) => p.id === placed.id)!;
    return {
      id: String(placed.id),
      position: { x: placed.x ?? 0, y: placed.y ?? 0 },
      data: { label: nodeLabel(position) },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        width: 200,
        borderRadius: 10,
        border: position.isAdmin ? "2px solid #c8102e" : "1px solid var(--color-border, #d4d4d8)",
        background: "var(--color-card, #ffffff)",
        padding: 10,
        opacity: position.isActive ? 1 : 0.55,
      },
    } satisfies Node;
  });
}

function toFlowEdges(positions: OrgChartNode[]): Edge[] {
  return positions
    .filter((p) => p.parentId !== null)
    .map((p) => ({
      id: `e-${p.parentId}-${p.id}`,
      source: String(p.parentId),
      target: String(p.id),
    }));
}

export function OrgChartCanvas({ initialNodes, canEdit, loadError }: Props) {
  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(initialNodes));
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(initialNodes));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    loadError ? { type: "error", text: loadError } : null
  );

  /** The chart as it currently stands on screen, in plain data. */
  const currentChart = useMemo((): ChartNode[] => {
    const parentOf = new Map<string, string>();
    for (const edge of edges) parentOf.set(edge.target, edge.source);

    return nodes.map((node) => {
      const parent = parentOf.get(node.id);
      return {
        id: Number(node.id),
        title: initialNodes.find((p) => p.id === Number(node.id))?.title ?? "",
        parentId: parent ? Number(parent) : null,
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      };
    });
  }, [nodes, edges, initialNodes]);

  const savedChart = useMemo(
    (): ChartNode[] =>
      layoutChartNodes(initialNodes).map((n) => ({
        ...n,
        x: Math.round(n.x ?? 0),
        y: Math.round(n.y ?? 0),
      })),
    [initialNodes]
  );

  const pendingChanges = useMemo(
    () => diffChartNodes(savedChart, currentChart),
    [savedChart, currentChart]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((current) => applyNodeChanges(changes, current)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((current) => applyEdgeChanges(changes, current)),
    []
  );

  // Dragging from one position onto another means "this one reports to that
  // one". A position has a single parent, so any existing line into the target
  // is replaced rather than added to.
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const childId = Number(connection.target);
      const parentId = Number(connection.source);

      if (wouldCreateCycle(currentChart, childId, parentId)) {
        setMessage({
          type: "error",
          text: "That would make a reporting loop, so it was not connected.",
        });
        return;
      }

      setMessage(null);
      setEdges((current) => [
        ...current.filter((e) => e.target !== connection.target),
        { id: `e-${parentId}-${childId}`, source: connection.source!, target: connection.target! },
      ]);
    },
    [currentChart]
  );

  async function handleSave() {
    setBusy(true);
    setMessage(null);

    const res = await saveOrgChart(
      pendingChanges.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        x: node.x ?? 0,
        y: node.y ?? 0,
      }))
    );

    setBusy(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setMessage({
      type: "ok",
      text: `Saved ${res.saved} position${res.saved === 1 ? "" : "s"}.`,
    });
  }

  function handleReset() {
    setNodes(toFlowNodes(initialNodes));
    setEdges(toFlowEdges(initialNodes));
    setMessage(null);
  }

  return (
    <div className="space-y-3">
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

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={busy || pendingChanges.length === 0}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={busy || pendingChanges.length === 0}>
            Discard
          </Button>
          <p className="text-sm text-muted-foreground">
            {pendingChanges.length === 0
              ? "No unsaved changes."
              : `${pendingChanges.length} unsaved change${pendingChanges.length === 1 ? "" : "s"}.`}
          </p>
        </div>
      )}

      <div className="h-[70vh] rounded-xl border border-border bg-card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={canEdit ? onNodesChange : undefined}
          onEdgesChange={canEdit ? onEdgesChange : undefined}
          onConnect={canEdit ? onConnect : undefined}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          edgesReconnectable={canEdit}
          elementsSelectable={canEdit}
          colorMode="system"
          fitView
          proOptions={{ hideAttribution: false }}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {canEdit && (
        <p className="text-xs text-muted-foreground">
          Select a line and press Delete to remove a reporting link. A position with no line above it
          sits at the top of the chart.
        </p>
      )}
    </div>
  );
}
