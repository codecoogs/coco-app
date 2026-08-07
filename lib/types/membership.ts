/**
 * Types for the in-app membership Checkout feature (public.membership_plans,
 * public.memberships, extended public.payments, public.semesters).
 * See Membership_Stripe_Implementation_Plan.docx and the
 * 20260804140000/150000 and 20260805100000/110000 migrations for the source
 * of truth. membership_plans has no dates of its own - a 'semester' plan
 * derives them from its linked semester, a 'yearly' plan from its linked
 * academic_year, so there's one place to correct a date instead of one per
 * plan.
 */

export type MembershipPlanKind = "semester" | "yearly";

export type SemesterTerm = "fall" | "spring" | "summer";

export type Semester = {
  id: string;
  academic_year_id: string;
  label: string;
  term: SemesterTerm;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

export type AcademicYear = {
  id: string;
  label: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
};

export type SemesterInput = {
  academic_year_id: string;
  label: string;
  term: SemesterTerm;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

export type AcademicYearInput = {
  label: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

export type MembershipPlan = {
  id: string;
  name: string;
  kind: MembershipPlanKind;
  stripe_price_id: string;
  amount_cents: number;
  semester_id: string | null;
  academic_year_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Plan joined with its period's dates/label, for display. */
export type MembershipPlanWithPeriod = MembershipPlan & {
  period_label: string;
  starts_at: string;
  ends_at: string;
};

export type MembershipPlanInput = {
  name: string;
  kind: MembershipPlanKind;
  stripe_price_id: string;
  amount_cents: number;
  semester_id: string | null;
  academic_year_id: string | null;
};

export type MembershipStatus = "pending" | "active" | "expired" | "refunded";

export type Membership = {
  id: string;
  user_id: string;
  plan_id: string;
  status: MembershipStatus;
  starts_at: string;
  ends_at: string;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Membership joined with its plan, for the Settings tab and admin views. */
export type MembershipWithPlan = Membership & {
  plan_name: string;
  plan_kind: MembershipPlanKind;
};

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type Payment = {
  id: string;
  user_id: string;
  stripe_payment_intent_id: string | null;
  status: PaymentStatus | null;
  payment_type: string | null;
  amount: number | null;
  currency: string;
  membership_id: string | null;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

/** True if a membership is currently in force - active status and not past its end date. */
export function isMembershipCurrent(membership: Pick<Membership, "status" | "ends_at">): boolean {
  return membership.status === "active" && membership.ends_at >= new Date().toISOString().slice(0, 10);
}
