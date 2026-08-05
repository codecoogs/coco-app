import Stripe from "stripe";

/**
 * Server-only Stripe client, or null if STRIPE_SECRET_KEY is not configured.
 * Prefer this over throwing when you can return a user-visible error.
 */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}
