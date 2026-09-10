"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requestOtp, verifyOtp } from "@/lib/otp/store";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/otp/cooldown";
import { sendOtpEmail } from "@/lib/otp/send-email";
import { validatePassword } from "@/lib/validation";

async function findConfirmedUserByEmail(email: string) {
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
 * Always reports success regardless of whether the email exists, so this
 * endpoint can't be used to enumerate registered accounts.
 */
export async function requestPasswordResetOtp(
  email: string
): Promise<{ ok: true; retryAfterSeconds: number }> {
  const user = await findConfirmedUserByEmail(email);
  if (user) {
    // Honour the cooldown here too. This path used to send unconditionally, so
    // re-submitting the form mailed a code on every click while the "Resend"
    // button was throttled - the asymmetry that let the mailer be flooded.
    const { code, shouldSend } = await requestOtp(user.id, "password_reset");
    if (shouldSend) {
      await sendOtpEmail({
        authId: user.id,
        email: email.trim(),
        purpose: "password_reset",
        code,
      });
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
  const user = await findConfirmedUserByEmail(email);
  if (user) {
    const { code, shouldSend } = await requestOtp(user.id, "password_reset");
    if (shouldSend) {
      await sendOtpEmail({
        authId: user.id,
        email: email.trim(),
        purpose: "password_reset",
        code,
      });
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

  const user = await findConfirmedUserByEmail(input.email);
  if (!user) {
    return { ok: false, error: "No active code. Request a new one." };
  }

  const result = await verifyOtp(user.id, "password_reset", input.code);
  if (!result.ok) return result;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: input.newPassword,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
