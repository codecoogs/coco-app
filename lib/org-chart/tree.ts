/**
 * The org chart as plain data, so the rules can be tested without a canvas.
 *
 * A cycle here would be worse than a cosmetic bug: current_user_can_assign_to()
 * walks parent_position_id to decide who may hand work to whom, so a loop would
 * make the permission question unanswerable. wouldCreateCycle() is what the
 * canvas checks before it lets a connection be drawn.
 */

export type ChartNode = {
  id: number;
  title: string;
  parentId: number | null;
  x: number | null;
  y: number | null;
};

export const COLUMN_WIDTH = 240;
export const ROW_HEIGHT = 140;

/** True if making `childId` report to `parentId` would close a loop. */
export function wouldCreateCycle(
  nodes: ChartNode[],
  childId: number,
  parentId: number | null
): boolean {
  if (parentId === null) return false;
  if (parentId === childId) return true;

  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  const seen = new Set<number>();
  let current: number | null | undefined = parentId;

  while (current !== null && current !== undefined) {
    if (current === childId) return true;
    // Data already loops; stop rather than spin.
    if (seen.has(current)) return false;
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }

  return false;
}

/** Depth from the root, and 0 for anything caught in a loop. */
function depthOf(node: ChartNode, parentOf: Map<number, number | null>): number {
  const seen = new Set<number>([node.id]);
  let depth = 0;
  let current = node.parentId;

  while (current !== null && current !== undefined) {
    if (seen.has(current)) return 0;
    seen.add(current);
    depth += 1;
    current = parentOf.get(current) ?? null;
  }

  return depth;
}

/**
 * Fills in coordinates for anything never placed by hand, so the first time
 * someone opens the chart it already reads as a tree. Saved positions win.
 */
export function layoutChartNodes(nodes: ChartNode[]): ChartNode[] {
  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  const byDepth = new Map<number, ChartNode[]>();

  for (const node of nodes) {
    const depth = depthOf(node, parentOf);
    const row = byDepth.get(depth) ?? [];
    row.push(node);
    byDepth.set(depth, row);
  }

  const placed = new Map<number, { x: number; y: number }>();
  for (const [depth, row] of byDepth) {
    row
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((node, index) => {
        placed.set(node.id, { x: index * COLUMN_WIDTH, y: depth * ROW_HEIGHT });
      });
  }

  return nodes.map((node) => ({
    ...node,
    x: node.x ?? placed.get(node.id)?.x ?? 0,
    y: node.y ?? placed.get(node.id)?.y ?? 0,
  }));
}

/** The nodes whose reporting line or coordinates actually moved. */
export function diffChartNodes(before: ChartNode[], after: ChartNode[]): ChartNode[] {
  const original = new Map(before.map((n) => [n.id, n]));

  return after.filter((node) => {
    const was = original.get(node.id);
    if (!was) return true;
    return was.parentId !== node.parentId || was.x !== node.x || was.y !== node.y;
  });
}

/**
 * Every node that sits on a loop. The canvas refuses to draw one, but the save
 * action checks the whole chart again before writing: a loop would break the
 * assignment rules, so it must not be possible to post one past the UI.
 */
export function findLoopedNodeIds(nodes: ChartNode[]): number[] {
  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  const looped = new Set<number>();

  for (const node of nodes) {
    const walked = new Set<number>([node.id]);
    let current = node.parentId;

    while (current !== null && current !== undefined) {
      if (walked.has(current)) {
        if (current === node.id) looped.add(node.id);
        break;
      }
      walked.add(current);
      current = parentOf.get(current) ?? null;
    }
  }

  return [...looped];
}
