/**
 * The one place the app talks to Resend. Every outbound email goes through
 * here so the API key, the sender address and the failure handling are
 * defined once - notably, Resend's own error text never reaches a member,
 * since it names the account and echoes the address back.
 *
 * Deliberately not routed through Supabase's mailer: that charges each send
 * against Supabase Auth's per-project email limit on top of Resend's own,
 * and Supabase's is the lower of the two.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ error?: string }> {
  const { to, subject, html } = params;

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
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
  } catch {
    return { error: "Could not reach the email service. Try again shortly." };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Resend rejected an email (${response.status}): ${detail}`);
    return { error: "Could not send the email. Try again shortly." };
  }

  return {};
}
