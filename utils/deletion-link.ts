/**
 * Deletion Link Generator
 * Creates secure, time-limited confirmation links for account deletion
 */

import { createServerSupabaseClient } from './supabase'
import nodemailer from 'nodemailer'

interface DeletionLinkParams {
  deletionId: string
  userEmail: string
  expiresIn?: number // seconds, default 86400 (24 hours)
}

interface GeneratedLink {
  url: string
  expiresAt: Date
  deletionId: string
}

/**
 * Generate a deletion confirmation link
 * Link format: {APP_URL}/confirm-deletion?token={deletionId}
 */
export function generateDeletionLink({
  deletionId,
  userEmail,
  expiresIn = 86400, // 24 hours
}: DeletionLinkParams): GeneratedLink {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://codecoogs.com'
  const url = `${appUrl}/confirm-deletion?token=${encodeURIComponent(deletionId)}`
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  return {
    url,
    expiresAt,
    deletionId,
  }
}

/**
 * Send deletion confirmation email via Supabase SMTP
 * Uses the SMTP configuration already set up in Supabase
 */
export async function sendDeletionConfirmationEmail(
  userEmail: string,
  userName: string,
  deletionId: string,
  deletionLink: GeneratedLink
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  // Verify user exists
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (!userData) {
    throw new Error('User not found')
  }

  // Get email content
  const htmlContent = getEmailHtml({
    Name: userName,
    ConfirmationLink: deletionLink.url,
    DeletionId: deletionId,
  })

  const textContent = getEmailText({
    Name: userName,
    ConfirmationLink: deletionLink.url,
    DeletionId: deletionId,
  })

  // Create transporter using Supabase SMTP configuration
  const transporter = nodemailer.createTransport({
    host: process.env.SUPABASE_MAIL_HOST || 'smtp.supabase.co',
    port: parseInt(process.env.SUPABASE_MAIL_PORT || '465'),
    secure: process.env.SUPABASE_MAIL_SECURE !== 'false', // true for 465, false for other ports
    auth: {
      user: process.env.SUPABASE_MAIL_FROM_EMAIL || 'noreply@codecoogs.com',
      pass: process.env.SUPABASE_MAIL_FROM_PASSWORD || '',
    },
  })

  try {
    const mailOptions = {
      from: `CodeCoogs <${process.env.SUPABASE_MAIL_FROM_EMAIL || 'noreply@codecoogs.com'}>`,
      to: userEmail,
      subject: 'Confirm Your CodeCoogs Account Deletion',
      text: textContent,
      html: htmlContent,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Deletion confirmation email sent:', info.messageId)

    // Log email send for audit trail (optional)
    await supabase
      .from('deleted_users')
      .update({ deletion_requested_at: new Date() })
      .eq('id', deletionId)
  } catch (error) {
    console.error('Error sending deletion email:', error)
    throw new Error('Failed to send confirmation email')
  }
}

/**
 * Verify deletion link hasn't expired
 */
export async function verifyDeletionLinkExpiration(
  deletionId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data: deletionRecord } = await supabase
    .from('deleted_users')
    .select('deletion_requested_at')
    .eq('id', deletionId)
    .single()

  if (!deletionRecord) {
    return false
  }

  // Link expires 24 hours after deletion was requested
  const expirationTime = new Date(
    new Date(deletionRecord.deletion_requested_at).getTime() + 24 * 60 * 60 * 1000
  )

  return new Date() < expirationTime
}

/**
 * Get email HTML content
 */
function getEmailHtml(variables: Record<string, string>): string {
  let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
        .warning-box { background-color: #fee2e2; border: 1px solid #fca5a5; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .warning-box strong { color: #991b1b; }
        .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
        .footer { color: #6b7280; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .code { font-family: monospace; background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
        .highlight { color: #1e40af; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Confirm Account Deletion</h1>
        </div>

        <div class="content">
            <p>Hello {{ Name }},</p>

            <p>We received a request to delete your CodeCoogs account.</p>

            <div class="warning-box">
                <strong>⚠️ This action is permanent</strong>
                <p>Once you confirm, your account will be marked for deletion. Your data will be permanently removed after 30 days. You can cancel anytime during this period by emailing us.</p>
            </div>

            <p><strong>Click the button below to confirm your account deletion:</strong></p>

            <div style="text-align: center;">
                <a href="{{ ConfirmationLink }}" class="button">Confirm Account Deletion</a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link in your browser:<br>
            <code style="word-break: break-all;">{{ ConfirmationLink }}</code></p>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>What happens next:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Click the link above to confirm</li>
                    <li>You'll be logged out immediately</li>
                    <li>Your data will be deleted in 30 days</li>
                    <li>Payment records kept for 7 years (tax requirement)</li>
                    <li>Admins can restore your account anytime during 30 days</li>
                </ul>
            </div>

            <p><strong>Didn't request this?</strong><br>
            If you didn't request account deletion, ignore this email and your account will remain active.</p>

            <p><strong>Change your mind?</strong><br>
            Email us within 30 days: <span class="highlight">main@codecoogs.com</span></p>

            <div class="footer">
                <p><strong>CodeCoogs</strong><br>
                A student-led nonprofit computer science organization at the University of Houston<br>
                4465 UNIVERSITY DRIVE MAILBOX 355<br>
                HOUSTON TX 77204</p>

                <p style="margin-top: 15px;">
                Deletion ID: <span class="code">{{ DeletionId }}</span><br>
                Link expires in: <strong>24 hours</strong>
                </p>

                <p style="margin-top: 15px; font-size: 11px;">
                This is an automated email. Please do not reply directly to this message.
                </p>
            </div>
        </div>
    </div>
</body>
</html>`

  // Replace variables
  Object.entries(variables).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{ ${key} }}`, 'g'), value)
  })

  return html
}

/**
 * Get email text content
 */
function getEmailText(variables: Record<string, string>): string {
  let text = `CONFIRM YOUR ACCOUNT DELETION

Hello {{ Name }},

We received a request to delete your CodeCoogs account.

⚠️  THIS ACTION IS PERMANENT

Once you confirm, your account will be marked for deletion. Your data will be permanently removed after 30 days. You can cancel anytime during this period by emailing us.

CONFIRM YOUR DELETION:
{{ ConfirmationLink }}

---

WHAT HAPPENS NEXT:

1. Click the link above to confirm
2. You'll be logged out immediately
3. Your data will be deleted in 30 days
4. Payment records kept for 7 years (tax requirement)
5. Admins can restore your account anytime during 30 days

---

DIDN'T REQUEST THIS?

If you didn't request account deletion, ignore this email and your account will remain active.

CHANGE YOUR MIND?

Email us within 30 days: main@codecoogs.com

---

Deletion ID: {{ DeletionId }}
Link expires in: 24 hours

CodeCoogs
A student-led nonprofit computer science organization at the University of Houston
4465 UNIVERSITY DRIVE MAILBOX 355
HOUSTON TX 77204

This is an automated email. Please do not reply directly to this message.`

  // Replace variables
  Object.entries(variables).forEach(([key, value]) => {
    text = text.replace(new RegExp(`{{ ${key} }}`, 'g'), value)
  })

  return text
}

/**
 * Validate deletion token format and existence
 */
export async function validateDeletionToken(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') {
    return false
  }

  const supabase = await createServerSupabaseClient()

  const { data: record } = await supabase
    .from('deleted_users')
    .select('id, status')
    .eq('id', token)
    .single()

  if (!record) {
    return false
  }

  // Only valid if still pending
  if (record.status !== 'pending') {
    return false
  }

  // Check if link expired
  return await verifyDeletionLinkExpiration(token)
}
