/** Response from GET /v1/users/points?categories=true */
export type PointCategory = {
  id: string;
  name: string;
  points_value: number;
  description: string;
};

export type PointCategoriesResponse = {
  success: boolean;
  point_categories: PointCategory[];
};

/** Response from GET /v1/users/points?transactions=true&... */
export type PointTransaction = {
  id: string;
  user_id: string;
  category_id: string;
  event_id: number;
  points_earned: number;
  created_at: string;
  created_by: string;
  academic_year_id: string;
};

export type PointTransactionsResponse = {
  success: boolean;
  point_transactions?: PointTransaction[];
  error?: string;
};

/** Response from GET /v1/users/points?id=... (no categories/transactions) */
export type UserPointsData = {
  first_name: string;
  last_name: string;
  points: number;
};

export type UserPointsResponse = {
  success: boolean;
  data?: UserPointsData;
  error?: string;
};
