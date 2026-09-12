/**
 * Cards carry a fractional rank instead of a 0,1,2 index: dropping one between
 * two others averages its neighbours, so a move writes a single row. That
 * matters here because everyone else is watching the same board over realtime
 * and would otherwise receive an update for every card in the column.
 */
export const RANK_STEP = 1000;

/** Below this, averaging two ranks starts to lose precision in a float. */
export const MIN_RANK_GAP = 1e-6;

export function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return RANK_STEP;
  if (before === null) return after! - RANK_STEP;
  if (after === null) return before + RANK_STEP;
  return (before + after) / 2;
}

/** True when the gap has closed far enough that the column needs renumbering. */
export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;
  return Math.abs(after - before) < MIN_RANK_GAP;
}

/** Evenly spaced ranks for a column, in the order given. */
export function rebalanceRanks(ranks: number[]): number[] {
  return ranks.map((_, index) => (index + 1) * RANK_STEP);
}
