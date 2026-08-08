# Account Deletion Implementation Guide

**For:** CodeCoogs Development Team  
**Date:** August 7, 2026  
**Status:** Ready for implementation

This document describes CodeCoogs' account deletion flow, database structure, and API implementation.

---

## Overview

CodeCoogs uses a **soft-delete with grace period** model for account deletion:

1. User requests deletion
2. Confirmation email sent
3. User confirms via email link
4. Account marked deleted (soft delete)
5. 30-day grace period (admin can restore)
6. After 30 days, data purged automatically
7. Financial records retained forever (IRS tax-exempt compliance)

---

## Your Deletion Policy

As a **tax-exempt organization under Texas law**, you must:
- ✅ Keep detailed financial records forever (IRS audit requirement)
- ✅ Keep audit trail of deletions (compliance)
- ✅ Allow admins to restore accounts during grace period
- ✅ Send confirmation emails (prevents accidents)
- ✅ Store both `deleted_at` in users table AND detailed record in `deleted_users` table

---

## Database Schema

### Users Table Changes

```sql
-- Add to existing users table
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN deletion_requested_at TIMESTAMP WITH TIME ZONE;
```

**Fields:**
- `deleted_at` - When account was fully purged (NULL until 30 days pass)
- `deletion_requested_at` - When user first requested deletion

### New: deleted_users Table

Comprehensive audit table for tracking all deletions:

```sql
CREATE TABLE deleted_users (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  auth_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  deletion_requested_at TIMESTAMP,      -- When user clicked "delete"
  deletion_confirmed_at TIMESTAMP,      -- When user confirmed via email
  deletion_completed_at TIMESTAMP,      -- When 30 days passed and data purged
  backup_exported BOOLEAN,              -- Did user request data backup?
  backup_export_requested_at TIMESTAMP, -- When they requested it
  restored_at TIMESTAMP,                -- When admin restored (if applicable)
  restored_by_user_id UUID,             -- Which admin restored it
  deletion_reason TEXT,                 -- Why they deleted (optional note)
  status TEXT,                          -- pending/confirmed/purged/restored
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**RLS Policies:**
- Only superadmin can view `deleted_users` records
- Only superadmin can perform restores

---

## Deletion Flow: Step-by-Step

### Step 1: User Requests Deletion

**File:** `app/dashboard/settings/DeleteAccountSection.tsx`  
**Action:** User clicks "Delete My Account" button

What happens:
- User sees warning: "This is permanent"
- Can choose to export backup (optional)
- Clicks "Send Confirmation Email"

**API Call:**
```
POST /api/user/request-deletion
Body: { }
```

### Step 2: Backend Creates Deletion Record

**File:** `app/api/user/request-deletion/route.ts`

What happens:
1. Check if deletion already requested (prevent duplicates)
2. Get user's email from database
3. Create record in `deleted_users` table with status: "pending"
4. Update `users` table `deletion_requested_at` field
5. Send confirmation email with unique token

**Response:**
```json
{
  "success": true,
  "message": "Check your email for confirmation link",
  "deletionId": "uuid-here"
}
```

### Step 3: User Confirms via Email

**File:** `app/confirm-deletion/page.tsx`  
**URL:** `https://yourapp.com/confirm-deletion?token={deletionId}`

User receives email with link → clicks it → lands on confirmation page

What happens:
1. Display final warning
2. Option to export data as JSON
3. User clicks "Confirm Deletion"

**API Call:**
```
POST /api/user/confirm-deletion
Body: {
  "deletionId": "uuid-from-email",
  "exportBackup": true/false
}
```

### Step 4: Backend Confirms Deletion

**File:** `app/api/user/confirm-deletion/route.ts`

What happens:
1. Verify deletion record exists and is still "pending"
2. If user requested backup: export JSON (TODO: implement)
3. Update `deleted_users` status to "confirmed"
4. Set `deletion_confirmed_at` timestamp
5. **Revoke all auth sessions** (user logged out immediately)
6. Schedule purge job for 30 days from now

**Response:**
```json
{
  "success": true,
  "message": "Account deletion confirmed. Data will be purged in 30 days."
}
```

### Step 5: Admin Can Restore (30-Day Window)

**File:** `app/api/admin/restore-deleted-user/route.ts`

If user changes their mind during 30-day grace period:

1. Admin navigates to deleted accounts list
2. Clicks "Restore Account"
3. System verifies it's within 30-day window
4. Restores `users` data
5. Updates `deleted_users` status to "restored"
6. Logs which admin performed restore

**API Call:**
```
POST /api/admin/restore-deleted-user
Body: { "deletionId": "uuid" }
```

### Step 6: Automatic Purge After 30 Days

**Handled by:** Scheduled job/cron function (TODO: implement)

What happens:
1. Run daily: find accounts where `deletion_confirmed_at + 30 days < now()`
2. For each account:
   - Delete from `form_responses`
   - Delete from `point_transactions`
   - Delete from `events_attendance`
   - Delete from `teams_members`
   - Delete from `users` (finally)
   - Update `deleted_users.status` to "purged"
   - Set `deleted_users.deletion_completed_at`
3. **Financial records kept forever** (separate table not deleted)

---

## Files Created

### Database Migrations
- `supabase/migrations/20260807000000_add_user_deletion_fields.sql`
- `supabase/migrations/20260807000001_create_deleted_users_table.sql`

### API Endpoints
- `app/api/user/request-deletion/route.ts` - Initiate deletion
- `app/api/user/confirm-deletion/route.ts` - Confirm deletion via email
- `app/api/admin/restore-deleted-user/route.ts` - Admin restore

### UI Components
- `app/dashboard/settings/DeleteAccountSection.tsx` - Settings page component
- `app/confirm-deletion/page.tsx` - Email confirmation page

---

## Implementation Checklist

### Phase 1: Database (REQUIRED FIRST)
- [ ] Run migration: `20260807000000_add_user_deletion_fields.sql`
- [ ] Run migration: `20260807000001_create_deleted_users_table.sql`
- [ ] Verify `deleted_users` table created
- [ ] Verify `deleted_at` and `deletion_requested_at` columns added to `users`

### Phase 2: API Endpoints
- [ ] Implement `request-deletion` endpoint
- [ ] Implement `confirm-deletion` endpoint
- [ ] Implement `restore-deleted-user` endpoint
- [ ] Test each endpoint manually
- [ ] Add error handling

### Phase 3: Email Service
- [ ] Set up Supabase email service (or SendGrid/Resend)
- [ ] Create email template for deletion confirmation
- [ ] Include confirmation link in email
- [ ] Test sending confirmation emails

### Phase 4: UI Components
- [ ] Add `DeleteAccountSection` to settings page
- [ ] Create `confirm-deletion` page
- [ ] Test deletion flow end-to-end
- [ ] Test restore flow

### Phase 5: Admin Tools
- [ ] Create admin page to view deleted accounts
- [ ] Add restore button on admin page
- [ ] Add filter for "pending" vs "confirmed" deletions

### Phase 6: Automation
- [ ] Implement daily purge cron job
- [ ] Test that accounts are purged after 30 days
- [ ] Verify financial records are NOT purged

### Phase 7: Compliance
- [ ] Document deletion policy in Privacy Policy ✓ (already done)
- [ ] Add legal disclaimers ✓ (already done)
- [ ] Brief all officers on deletion process
- [ ] Create runbook for handling deletion requests

---

## Data What Gets Deleted vs Kept

### Deleted After 30 Days
- Profile information (name, email, phone)
- Event attendance records
- Points and leaderboard entries
- Form responses
- Support tickets
- Avatar/profile photos
- Team memberships

### KEPT Forever (Tax Law)
- Financial transactions (Stripe payments, donations)
- Invoice records
- Audit trail in `deleted_users` table
- Anonymized usage statistics

---

## Email Template

**Subject:** Confirm Your CodeCoogs Account Deletion

```
Hello [NAME],

We received a request to delete your CodeCoogs account. 

⚠️ This action is permanent. Click the link below to confirm:

[CONFIRMATION LINK]

Link expires in: 24 hours
Deletion ID: [ID]

If you didn't request this, ignore this email and your account will remain active.

You can also cancel deletion anytime within 30 days by contacting:
main@codecoogs.com

---
CodeCoogs
University of Houston
```

---

## Testing Checklist

### Manual Testing
- [ ] Request deletion - no errors
- [ ] Receive confirmation email
- [ ] Click email link - confirmation page works
- [ ] Confirm deletion - logged out
- [ ] Admin can view deleted account in audit log
- [ ] Admin can restore account
- [ ] User can sign back in after restore
- [ ] Deleted account doesn't appear in normal queries

### Edge Cases
- [ ] Duplicate deletion requests → error message
- [ ] Invalid confirmation link → error page
- [ ] Confirmation link expires after 24 hours
- [ ] Can't restore after 30 days
- [ ] Financial records still exist after deletion

---

## Common Questions

**Q: Can users recover their data after deletion?**  
A: Only during the 30-day grace period, and only by contacting an admin to restore their account.

**Q: What if they want their backup?**  
A: If they exported backup at deletion time, they get JSON file. Can also request via data-access endpoint within 30 days.

**Q: Why keep the deletion audit log?**  
A: Legal compliance. If someone claims their data was misused, you have proof you deleted it.

**Q: What about Discord/Stripe data?**  
A: You can't delete from those services (they have their own policies). Your local data deletion is separate.

**Q: How long do we need to keep payment records?**  
A: 7 years minimum (IRS requirement). For a tax-exempt org, auditors may ask for this.

---

## Future Enhancements

1. **Scheduled Job Implementation**
   - Use `pg-cron` in Supabase or external cron service
   - Run daily purge at specific time (e.g., 2am UTC)

2. **Data Export Enhancement**
   - Create automated export to ZIP file
   - Include all user data in structured JSON
   - Allow email delivery of backup

3. **Admin Dashboard**
   - View all deleted accounts
   - See deletion timeline
   - One-click restore

4. **Analytics**
   - Track deletion reasons (optional survey)
   - Monitor deletion rates
   - Identify if feature drives users away

---

## Support

Questions about implementation?  
Email: main@codecoogs.com

---

**Last Updated:** August 7, 2026  
**Status:** Ready for development
