"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requestOtp, verifyOtp } from "@/lib/otp/store";
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
): Promise<{ ok: true }> {
  const user = await findConfirmedUserByEmail(email);
  if (user) {
    const { code } = await requestOtp(user.id, "password_reset");
    await sendOtpEmail({
      authId: user.id,
      email: email.trim(),
      purpose: "password_reset",
      code,
    });
  }
  return { ok: true };
}

/** Same idempotent semantics as the initial request: reuses the active code while resending. */
export async function resendPasswordResetOtp(
  email: string
): Promise<{ ok: true }> {
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
  return { ok: true };
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
