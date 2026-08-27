import { createAdminClient } from "@/lib/supabase/admin";
import type { OtpPurpose } from "./store";

/**
 * Writes the code into the user's metadata (rendered by the custom
 * otp_code.html template as {{ .Data.otp_code }}), then triggers Supabase's
 * existing email transport to actually send it. Supabase's own token/link
 * is generated as a side effect but never rendered or used for
 * verification — public.otp_codes is the source of truth for that.
 */
export async function sendOtpEmail(params: {
  authId: string;
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ error?: string }> {
  const { authId, email, purpose, code } = params;
  const admin = createAdminClient();

  const { data: userData, error: getUserError } =
    await admin.auth.admin.getUserById(authId);
  if (getUserError || !userData.user) {
    return { error: getUserError?.message ?? "User not found." };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    authId,
    {
      user_metadata: {
        ...userData.user.user_metadata,
        otp_code: code,
        otp_purpose_label:
          purpose === "signup" ? "verify your account" : "reset your password",
      },
    }
  );
  if (updateError) return { error: updateError.message };

  const { error: sendError } =
    purpose === "signup"
      ? await admin.auth.resend({ type: "signup", email })
      : await admin.auth.resetPasswordForEmail(email);
  if (sendError) return { error: sendError.message };

  return {};
}
