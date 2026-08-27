import { createAdminClient } from "@/lib/supabase/admin";
import { generateOtpCode } from "./generate";
import { getOtpExpiryMinutes } from "./env";

export type OtpPurpose = "signup" | "password_reset";

const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

type OtpRow = {
  id: string;
  code: string;
  expires_at: string;
  attempts: number;
  last_sent_at: string;
};

async function getActiveRow(
  authId: string,
  purpose: OtpPurpose
): Promise<OtpRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("otp_codes")
    .select("id, code, expires_at, attempts, last_sent_at")
    .eq("auth_id", authId)
    .eq("purpose", purpose)
    .is("used_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as OtpRow | null;
}

export type RequestOtpResult = {
  code: string;
  /** False when an active code exists but is still within the resend cooldown. */
  shouldSend: boolean;
};

/**
 * Returns the active code for (authId, purpose), creating one if none
 * exists. Idempotent: a still-valid code is reused rather than rotated, so
 * repeated requests (e.g. clicking "resend") don't generate a new code
 * every time.
 */
export async function requestOtp(
  authId: string,
  purpose: OtpPurpose
): Promise<RequestOtpResult> {
  const admin = createAdminClient();
  const existing = await getActiveRow(authId, purpose);
  const now = new Date();

  if (existing) {
    const expired = new Date(existing.expires_at) <= now;
    if (!expired) {
      const elapsedSeconds =
        (now.getTime() - new Date(existing.last_sent_at).getTime()) / 1000;
      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        return { code: existing.code, shouldSend: false };
      }
      const { error } = await admin
        .from("otp_codes")
        .update({ last_sent_at: now.toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { code: existing.code, shouldSend: true };
    }
    // Expired but never used/deleted: clear it so a fresh row can be created.
    const { error } = await admin
      .from("otp_codes")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  }

  const code = generateOtpCode();
  const expiresAt = new Date(
    now.getTime() + getOtpExpiryMinutes() * 60_000
  ).toISOString();
  const { error } = await admin.from("otp_codes").insert({
    auth_id: authId,
    purpose,
    code,
    expires_at: expiresAt,
    last_sent_at: now.toISOString(),
  });
  if (error) throw new Error(error.message);
  return { code, shouldSend: true };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string };

/** Verifies a submitted code against the active row for (authId, purpose). */
export async function verifyOtp(
  authId: string,
  purpose: OtpPurpose,
  submittedCode: string
): Promise<VerifyOtpResult> {
  const admin = createAdminClient();
  const existing = await getActiveRow(authId, purpose);
  if (!existing) {
    return { ok: false, error: "No active code. Request a new one." };
  }

  if (new Date(existing.expires_at) <= new Date()) {
    await admin.from("otp_codes").delete().eq("id", existing.id);
    return { ok: false, error: "Code expired. Request a new one." };
  }

  const attempts = existing.attempts + 1;
  if (attempts > MAX_ATTEMPTS) {
    await admin.from("otp_codes").delete().eq("id", existing.id);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  if (existing.code !== submittedCode) {
    const { error } = await admin
      .from("otp_codes")
      .update({ attempts })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    const remaining = MAX_ATTEMPTS - attempts;
    return {
      ok: false,
      error: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`,
    };
  }

  const { error } = await admin
    .from("otp_codes")
    .update({ used_at: new Date().toISOString(), attempts })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
