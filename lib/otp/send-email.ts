import type { OtpPurpose } from "./store";

/**
 * Sent through Resend's API directly rather than through Supabase's mailer.
 * The old path wrote the code into user_metadata and triggered
 * admin.auth.resend()/resetPasswordForEmail() so Supabase would render it,
 * which meant every OTP was charged against Supabase Auth's own per-project
 * email rate limit (and its per-address minimum interval) on top of Resend's
 * — Supabase's limit is the lower of the two, so it was the one we hit. Going
 * straight to Resend also keeps a live code out of user_metadata, which the
 * account holder can read back from its own session.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  signup: "verify your account",
  password_reset: "reset your password",
};

const PURPOSE_SUBJECT: Record<OtpPurpose, string> = {
  signup: "Verify your CodeCoogs account",
  password_reset: "Reset your CodeCoogs password",
};

/** Port of supabase/templates/otp_code.html, with the values substituted here. */
function renderOtpEmail(code: string, purpose: OtpPurpose): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#18181b;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:420px;background-color:#27272a;border:1px solid #3f3f46;border-radius:12px;padding:32px;">
            <tr>
              <td align="center" style="color:#ffffff;font-size:20px;font-weight:600;padding-bottom:8px;">
                CodeCoogs
              </td>
            </tr>
            <tr>
              <td align="center" style="color:#d4d4d8;font-size:15px;padding-bottom:24px;">
                Use this code to ${PURPOSE_LABEL[purpose]}.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="display:inline-block;background-color:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:16px 24px;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:8px;font-family:'SF Mono',Consolas,Menlo,monospace;">
                  ${code}
                </span>
              </td>
            </tr>
            <tr>
              <td align="center" style="color:#a1a1aa;font-size:13px;">
                This code expires soon and can only be used once. If you didn't request this, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOtpEmail(params: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ error?: string }> {
  const { email, purpose, code } = params;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OTP_EMAIL_FROM;
  if (!apiKey || !from) {
    return { error: "Email is not configured. Contact an administrator." };
  }

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: PURPOSE_SUBJECT[purpose],
        html: renderOtpEmail(code, purpose),
      }),
    });
  } catch {
    return { error: "Could not reach the email service. Try again shortly." };
  }

  if (!response.ok) {
    // Resend's own message is for us, not the member: it names the account and
    // can carry the address back verbatim, so log it and return something safe.
    const detail = await response.text().catch(() => "");
    console.error(
      `Resend rejected the OTP email (${response.status}): ${detail}`
    );
    return { error: "Could not send the email. Try again shortly." };
  }

  return {};
}
