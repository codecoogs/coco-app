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
  totalPoints: number;
  rank: number | null;
  transactions: PointHistoryTransaction[];
  categories: PointHistoryCategory[];
};
