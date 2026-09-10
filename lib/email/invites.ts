// Extension is required so `npm test` (node --experimental-strip-types) can
// resolve this; tsconfig sets allowImportingTsExtensions for the same reason.
import { sendEmail } from "./send.ts";

/**
 * The two "come use the app" emails. They look the same and differ only in
 * why we are writing and where the button goes:
 *
 * - reinvite: there IS an account, it was never verified. Sent to the password
 *   reset flow, which mails a code and confirms the address on completion, so
 *   finishing it both sets a password and clears the unverified state.
 * - invite: there is NO account, just an email we collected at an event. Sent
 *   to signup, because there is nothing to reset.
 *
 * Neither carries a code. An OTP expires in minutes and these sit in an inbox
 * for days; the link starts the real flow, which mails a fresh code then.
 */

export type InviteParams = {
  firstName: string | null;
  email: string;
  /** Origin only, no trailing slash - see getSiteUrl(). */
  siteUrl: string;
};

export type RenderedEmail = { subject: string; html: string };

/**
 * Served from the deployed app rather than embedded: mail clients strip
 * data: URIs, and inlining a 250KB attachment on every send is worse than a
 * cached fetch. Most clients block remote images until the reader allows
 * them, so the wordmark below it carries the branding on its own and the img
 * is decorative (empty alt) with explicit dimensions, so a blocked image
 * leaves a fixed gap instead of reflowing the card.
 */
const LOGO_PATH = "/images/icons/coco-nice.png";

/** First names and emails are member-supplied and land inside markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Falls back to a plain greeting rather than "Hi ," when we have no name. */
function greeting(firstName: string | null): string {
  const name = firstName?.trim();
  return name ? `Hi ${escapeHtml(name)},` : "Hi there,";
}

function renderInviteEmail(params: {
  firstName: string | null;
  email: string;
  intro: string;
  ctaLabel: string;
  ctaHref: string;
  closing: string;
  logoUrl: string;
}): string {
  const { firstName, email, intro, ctaLabel, ctaHref, closing, logoUrl } =
    params;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border:1px solid #d4d4d8;border-radius:12px;padding:32px;">
            <tr>
              <td align="center" style="padding-bottom:8px;">
                <img src="${escapeHtml(logoUrl)}" alt="" width="88" height="88" style="display:block;border:0;outline:none;text-decoration:none;width:88px;height:88px;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="color:#18181b;font-size:20px;font-weight:600;padding-bottom:20px;">
                CodeCoogs
              </td>
            </tr>
            <tr>
              <td style="color:#27272a;font-size:15px;padding-bottom:12px;">
                ${greeting(firstName)}
              </td>
            </tr>
            <tr>
              <td style="color:#3f3f46;font-size:15px;line-height:22px;padding-bottom:24px;">
                ${intro}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background-color:#18181b;border-radius:8px;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                  ${ctaLabel}
                </a>
              </td>
            </tr>
            <tr>
              <td style="color:#52525b;font-size:13px;line-height:20px;padding-bottom:16px;">
                ${closing}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e4e4e7;padding-top:16px;color:#71717a;font-size:12px;line-height:18px;">
                Sent to ${escapeHtml(email)}. If the button doesn't work, paste this into your browser:<br />
                <span style="color:#52525b;word-break:break-all;">${escapeHtml(ctaHref)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * For an account that exists but was never verified. The link prefills the
 * address so someone who already stalled once does not have to retype it.
 */
export function renderReinvite(params: InviteParams): RenderedEmail {
  const { firstName, email, siteUrl } = params;
  const ctaHref = `${siteUrl}/forgot-password?email=${encodeURIComponent(email)}`;

  return {
    subject: "Finish setting up your CodeCoogs account",
    html: renderInviteEmail({
      firstName,
      email,
      logoUrl: `${siteUrl}${LOGO_PATH}`,
      intro:
        "You started a CodeCoogs account but never finished verifying your email, so you can't sign in yet. Picking a password will verify it at the same time and get you into the app.",
      ctaLabel: "Verify my account",
      ctaHref,
      closing:
        "We'll email you a 6-digit code, you choose a password, and you're in. Takes about a minute.",
    }),
  };
}

/**
 * For someone we only know from an event sign-in sheet - no account yet, so
 * there is nothing to reset and the link goes to signup.
 */
export function renderAttendanceInvite(params: InviteParams): RenderedEmail {
  const { firstName, email, siteUrl } = params;
  const ctaHref = `${siteUrl}/signup`;

  return {
    subject: "Create your CodeCoogs account",
    html: renderInviteEmail({
      firstName,
      email,
      logoUrl: `${siteUrl}${LOGO_PATH}`,
      intro:
        "Thanks for coming to a CodeCoogs event. You don't have an account yet - making one lets you track your points, sign up for events, and manage your membership.",
      ctaLabel: "Create my account",
      ctaHref,
      closing:
        "If you'd rather not hear from us, just ignore this email and we won't follow up.",
    }),
  };
}

export async function sendReinviteEmail(
  params: InviteParams
): Promise<{ error?: string }> {
  const { subject, html } = renderReinvite(params);
  return sendEmail({ to: params.email, subject, html });
}

export async function sendAttendanceInviteEmail(
  params: InviteParams
): Promise<{ error?: string }> {
  const { subject, html } = renderAttendanceInvite(params);
  return sendEmail({ to: params.email, subject, html });
}
