"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requestOtp, verifyOtp } from "@/lib/otp/store";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/otp/cooldown";
import { sendOtpEmail } from "@/lib/otp/send-email";
import { validatePassword } from "@/lib/validation";

async function findUserByEmail(email: string) {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || data.users.length === 0) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * The caller is never told whether the send failed - that would answer the
 * exact question this endpoint refuses to answer, namely whether the address
 * has an account. So log it instead: without this a failure is completely
 * silent, because sendEmail() returns its error rather than throwing and both
 * actions below report success either way. The function log is then the only
 * place a missing RESEND_API_KEY or a Resend rejection can surface.
 *
 * The address is deliberately left out of the message; the log line only needs
 * to say that sending broke, not to whom.
 */
async function sendResetCode(email: string, code: string): Promise<void> {
  const { error } = await sendOtpEmail({
    email: email.trim(),
    purpose: "password_reset",
    code,
  });
  if (error) {
    console.error(`Failed to send a password reset code: ${error}`);
  }
}

/**
 * Always reports success regardless of whether the email exists, so this
 * endpoint can't be used to enumerate registered accounts.
 *
 * Unverified accounts are deliberately included: an account that never
 * finished signup is otherwise stuck for good, since sign-in is refused
 * until the email is confirmed and confirmation only happened at signup.
 */
export async function requestPasswordResetOtp(
  email: string
): Promise<{ ok: true; retryAfterSeconds: number }> {
  const user = await findUserByEmail(email);
  if (user) {
    // Honour the cooldown here too. This path used to send unconditionally, so
    // re-submitting the form mailed a code on every click while the "Resend"
    // button was throttled - the asymmetry that let the mailer be flooded.
    const { code, shouldSend } = await requestOtp(user.id, "password_reset");
    if (shouldSend) {
      await sendResetCode(email, code);
    }
  }
  // Always the full cooldown, never the real remaining time: a shorter wait for
  // a registered address would turn this countdown into an account oracle.
  return { ok: true, retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
}

/** Same idempotent semantics as the initial request: reuses the active code while resending. */
export async function resendPasswordResetOtp(
  email: string
): Promise<{ ok: true; retryAfterSeconds: number }> {
  const user = await findUserByEmail(email);
  if (user) {
    const { code, shouldSend } = await requestOtp(user.id, "password_reset");
    if (shouldSend) {
      await sendResetCode(email, code);
    }
  }
  // Constant for the same anti-enumeration reason as the initial request.
  return { ok: true, retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
}

export type ResetPasswordResult = { ok: true } | { ok: false; error: string };

export async function verifyPasswordResetOtpAndSetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  const passwordResult = validatePassword(input.newPassword, {
    minLength: 6,
  });
  if (!passwordResult.valid) {
    return { ok: false, error: passwordResult.error ?? "Invalid password." };
  }

  const user = await findUserByEmail(input.email);
  if (!user) {
    return { ok: false, error: "No active code. Request a new one." };
  }

  const result = await verifyOtp(user.id, "password_reset", input.code);
  if (!result.ok) return result;

  // Confirm the email alongside the password. Returning a code that was
  // mailed to the address proves the same ownership that signup verification
  // asks for, so an unverified account completing this flow comes out of it
  // able to sign in - otherwise it resets its password and is still locked out.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: input.newPassword,
    email_confirm: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
