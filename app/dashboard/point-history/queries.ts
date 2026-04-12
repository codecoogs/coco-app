/** Shared types for point history (client + server). */

export type PointHistoryCategory = {
  id: string;
  name: string;
  points_value: number;
};

export type PointHistoryTransaction = {
  id: string;
  category_id: string | null;
  points_earned: number | null;
  created_at: string | null;
};

export type PointHistoryBundle = {
  /** Sum of `points_earned` from `point_transactions` for this member. */
  totalPoints: number;
  rank: number | null;
  transactions: PointHistoryTransaction[];
  categories: PointHistoryCategory[];
  memberFirstName: string | null;
};
