# Supabase Email Template Setup

**For:** CodeCoogs Account Deletion Confirmation Emails  
**Date:** August 7, 2026

## Email Templates Created

Two templates have been created in `/supabase/email-templates/`:
- `deletion-confirmation.html` - HTML version (styled)
- `deletion-confirmation.txt` - Plain text version

## How to Configure in Supabase

### Option 1: Manual Setup (Recommended for now)

1. Go to your Supabase Dashboard → **Settings** → **Email Templates**
2. Click **Create Email Template**
3. Configure:
   - **Template ID:** `deletion-confirmation`
   - **Subject:** `Confirm Your CodeCoogs Account Deletion`
   - **Type:** Transactional

4. Copy the HTML from `supabase/email-templates/deletion-confirmation.html` into the template editor
5. Set variables in template:
   - `{{ .Name }}` - User's first name
   - `{{ .ConfirmationLink }}` - Full confirmation URL
   - `{{ .DeletionId }}` - Deletion record ID

### Option 2: Via Supabase CLI

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase email send-template deletion-confirmation \
  --to user@example.com \
  --variable Name=John \
  --variable ConfirmationLink=https://app.com/confirm-deletion?token=xyz \
  --variable DeletionId=uuid-here
```

## Template Variables

The email template uses these variables (passed from code):

| Variable | Example | Set By |
|----------|---------|--------|
| `{{ .Name }}` | John | User's first_name from DB |
| `{{ .ConfirmationLink }}` | `https://codecoogs.com/confirm-deletion?token=abc123` | `generateDeletionLink()` function |
| `{{ .DeletionId }}` | `550e8400-e29b-41d4-a716-446655440000` | UUID from deleted_users table |

## API Integration

The code uses `sendDeletionConfirmationEmail()` function from `utils/deletion-link.ts`:

```typescript
await sendDeletionConfirmationEmail(
  userData.email,           // To: user@example.com
  userData.first_name,      // Name variable
  deletionRecord.id,        // DeletionId variable
  deletionLink              // Contains ConfirmationLink
)
```

## Testing the Email

### Test 1: Verify Template Renders
1. Request account deletion in the app
2. Check email inbox (or spam folder)
3. Verify all template variables populated correctly

### Test 2: Verify Link Works
1. Click confirmation link in email
2. Should load `/confirm-deletion?token={id}` page
3. Page should show confirmation form

### Test 3: Verify Expiration
1. Note the deletion request time
2. Try accessing confirmation link after 24 hours
3. Should show "Link expired" error

## Email Customization

To customize the email template:

1. Edit `supabase/email-templates/deletion-confirmation.html`
2. Update the template in Supabase Dashboard
3. Redeploy changes

### Things to Customize
- Logo/branding
- Colors to match your brand
- Footer address (already set to: 4465 UNIVERSITY DRIVE MAILBOX 355, HOUSTON TX 77204)
- Organization name (already set to: CodeCoogs)
- Support email (already set to: main@codecoogs.com)

## Troubleshooting

### Email Not Sending
1. Check Supabase email service is enabled in settings
2. Verify email template exists
3. Check API logs for errors
4. Ensure user email is valid

### Template Variables Not Showing
1. Verify variable names match (case-sensitive)
2. Check code is passing correct variable names
3. Restart Supabase local development: `supabase stop && supabase start`

### Link Not Working
1. Verify `NEXT_PUBLIC_APP_URL` environment variable is set
2. Check token (deletionId) is correctly passed in URL
3. Ensure database record exists

## Email Configuration Checklist

- [ ] Email template created in Supabase dashboard
- [ ] Template ID is `deletion-confirmation`
- [ ] Subject line set correctly
- [ ] HTML template copied and verified
- [ ] All variables ({{ .Name }}, {{ .ConfirmationLink }}, {{ .DeletionId }}) present
- [ ] Test email sent successfully
- [ ] Confirmation link works
- [ ] Email displays correctly on mobile
- [ ] Support email (main@codecoogs.com) is correct

## Environment Variables Needed

```
# In your .env.local or Vercel settings:
NEXT_PUBLIC_APP_URL=https://yourapp.com

# Supabase already configured, no additional email vars needed
```

## Next Steps

1. Create email template in Supabase dashboard (see Option 1 above)
2. Test email sending by requesting account deletion
3. Verify confirmation link works
4. Then implement UI pages

---

**Created:** August 7, 2026  
**Email Templates Location:** `/supabase/email-templates/`  
**Utility Location:** `utils/deletion-link.ts`  
**API Route:** `app/api/user/request-deletion/route.ts`
