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

/** Response from GET /v1/users?active_memberships=true */
export type ActiveMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  major: string;
  classification: string;
  expected_graduation: string;
  membership: string;
  discord: string;
  due_date: string;
  last_payment_date: string;
};

export type ActiveMembersResponse = {
  success: boolean;
  active_members?: ActiveMember[];
  error?: string;
};

/** Response from GET /v1/users?payment_info=true - all users with payment/due info */
export type UserPaymentInfo = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  major?: string;
  classification?: string;
  expected_graduation?: string;
  membership: string;
  discord?: string;
  paid: boolean;
  last_payment_date: string;
  next_due_date: string;
};

export type UsersPaymentInfoResponse = {
  success: boolean;
  users_payment_info?: UserPaymentInfo[];
  error?: string;
};
