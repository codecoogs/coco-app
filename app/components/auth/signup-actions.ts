"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requestOtp, verifyOtp } from "@/lib/otp/store";
import { sendOtpEmail } from "@/lib/otp/send-email";
import { SIGNUP_MAJOR_OPTIONS } from "@/lib/signup-options";
import {
  validateEmail,
  validateExpectedGraduation,
  validatePassword,
  validatePersonName,
  validateUhId,
} from "@/lib/validation";

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

export type StartSignupResult =
  | { ok: true; authId: string; email: string }
  | { ok: false; error: string };

export async function startSignup(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  expectedGraduation: string;
  uhId: string;
  major: string;
}): Promise<StartSignupResult> {
  const fn = validatePersonName(input.firstName, "First name");
  if (!fn.valid) return { ok: false, error: fn.error ?? "Invalid first name." };
  const ln = validatePersonName(input.lastName, "Last name");
  if (!ln.valid) return { ok: false, error: ln.error ?? "Invalid last name." };
  const emailResult = validateEmail(input.email);
  if (!emailResult.valid) {
    return { ok: false, error: emailResult.error ?? "Invalid email." };
  }
  const passwordResult = validatePassword(input.password, { minLength: 6 });
  if (!passwordResult.valid) {
    return { ok: false, error: passwordResult.error ?? "Invalid password." };
  }
  const grad = validateExpectedGraduation(input.expectedGraduation);
  if (!grad.valid) {
    return { ok: false, error: grad.error ?? "Invalid expected graduation." };
  }
  const uhIdResult = validateUhId(input.uhId);
  if (!uhIdResult.valid) {
    return { ok: false, error: uhIdResult.error ?? "Invalid UH ID." };
  }
  if (
    !SIGNUP_MAJOR_OPTIONS.includes(
      input.major as (typeof SIGNUP_MAJOR_OPTIONS)[number]
    )
  ) {
    return { ok: false, error: "Please select a major." };
  }

  const email = input.email.trim();
  const uhId = input.uhId.trim();
  const profileData = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    major: input.major,
    expected_graduation: input.expectedGraduation.trim(),
    uh_id: uhId,
  };

  // Checked up front rather than relying on the DB's unique constraint:
  // admin.createUser() sanitizes trigger/constraint failures down to a
  // generic "Database error creating new user" before it reaches us, so a
  // duplicate uh_id can't be distinguished from any other failure after
  // the fact. Small TOCTOU race with two simultaneous signups is fine —
  // the constraint itself is still the real safety net.
  const admin = createAdminClient();
  const { data: uhIdMatch } = await admin
    .from("users")
    .select("id")
    .eq("uh_id", uhId)
    .maybeSingle();
  if (uhIdMatch) {
    return {
      ok: false,
      error: "That UH ID is already associated with another account.",
    };
  }

  // Created via the admin API (not the client-side signUp()) so nothing
  // auto-sends Supabase's own confirmation email — that email would render
  // {{ .Data.otp_code }} empty since our code isn't generated yet at this
  // point, and a second, later send collides with Supabase's own
  // per-address send-rate cooldown. We trigger the single real email
  // ourselves once the code exists (see sendOtpEmail below).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: false,
    user_metadata: profileData,
  });

  let authId: string | null = data.user?.id ?? null;

  if (error) {
    // Note: admin.createUser() sanitizes DB-level failures (including a
    // uh_id race lost to the pre-check above) down to a generic message —
    // the constraint name never reaches us here, so there's nothing to
    // pattern-match; the pre-check above is what actually surfaces the
    // friendly message in the common case.
    const isAlreadyRegistered = /already registered|already exists/i.test(
      error.message
    );
    if (!isAlreadyRegistered) {
      return { ok: false, error: error.message };
    }

    const existing = await findUserByEmail(email);
    if (!existing || existing.email_confirmed_at) {
      return {
        ok: false,
        error: "That email already has an account. Sign in instead.",
      };
    }

    // Abandoned, never-verified signup: resume it with the latest details
    // rather than blocking the user from ever completing signup.
    const { error: updateError } = await admin.auth.admin.updateUserById(
      existing.id,
      { user_metadata: { ...existing.user_metadata, ...profileData } }
    );
    if (updateError) return { ok: false, error: updateError.message };
    authId = existing.id;
  }

  if (!authId) {
    return { ok: false, error: "Something went wrong creating your account." };
  }

  const { code } = await requestOtp(authId, "signup");
  const { error: sendError } = await sendOtpEmail({
    authId,
    email,
    purpose: "signup",
    code,
  });
  if (sendError) return { ok: false, error: sendError };

  return { ok: true, authId, email };
}

export type VerifySignupOtpResult =
  | { ok: true; sessionEstablished: boolean }
  | { ok: false; error: string };

export async function verifySignupOtp(
  authId: string,
  code: string
): Promise<VerifySignupOtpResult> {
  const result = await verifyOtp(authId, "signup", code);
  if (!result.ok) return result;

  const admin = createAdminClient();
  const { data: userData, error: getUserError } =
    await admin.auth.admin.getUserById(authId);
  if (getUserError || !userData.user?.email) {
    return { ok: false, error: getUserError?.message ?? "User not found." };
  }
  const email = userData.user.email;

  const { error: confirmError } = await admin.auth.admin.updateUserById(
    authId,
    { email_confirm: true }
  );
  if (confirmError) return { ok: false, error: confirmError.message };

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return { ok: true, sessionEstablished: false };
  }

  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });

  return { ok: true, sessionEstablished: !sessionError };
}

export type ResendOtpResult = { ok: true } | { ok: false; error: string };

export async function resendSignupOtp(
  authId: string,
  email: string
): Promise<ResendOtpResult> {
  const { code, shouldSend } = await requestOtp(authId, "signup");
  if (!shouldSend) return { ok: true };
  const { error } = await sendOtpEmail({
    authId,
    email,
    purpose: "signup",
    code,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}
