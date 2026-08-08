# Data Collection Inventory

**Document Purpose:** Complete audit of all data CodeCoogs collects, stores, and processes  
**Created:** August 7, 2026  
**Last Updated:** August 7, 2026

This document tracks every data collection point in your application so that legal policies stay synchronized with actual practices.

## User Profile Data

### Required at Signup
- First name
- Last name
- Email address
- Password (hashed, never stored in plain text)
- Expected graduation date (YYYY-MM format)
- Major/field of study

### Optional/Editable in Profile
- Phone number
- Classification (Freshman, Sophomore, Junior, Senior)
- Discord username (when linked)
- Avatar/profile photo

### Automatically Collected
- Account creation timestamp
- Last login timestamp
- User ID (UUID)
- Account status (active, deactivated, deleted)

**Related Code Files:**
- `app/components/auth/SignUpModal.tsx` - Registration form
- `app/dashboard/settings/ProfileDetailsSection.tsx` - Profile editing

---

## Activity & Participation Data

### Events Participation
- Event attendance (which events user attended)
- Event RSVPs (events user plans to attend)
- Attendance timestamp
- Points awarded for attendance

**Related Code:**
- `supabase/migrations/20260218055313_remote_schema.sql` - events_attendance, events_attending tables

### Points & Leaderboard
- Points earned per activity
- Category of points (event attendance, workshop, etc.)
- Event ID associated with points
- Leaderboard ranking
- Academic year context
- Timestamps of point transactions

**Related Code:**
- `point_transactions` table in Supabase
- `leaderboard` table

### Team Participation
- Team membership (which teams user belongs to)
- Team lead status
- Team contribution data

**Related Code:**
- `teams` and `team_members` tables

---

## Forms & Surveys Data

### Form Responses
- All answers to form questions (text, multiple choice, dates, etc.)
- File uploads (stored in `form-uploads` bucket)
- Timestamp of submission
- Form ID and question IDs

### Pre-filled Form Fields (Auto-populated from Profile)
- First name, last name
- Email
- Phone
- Classification
- Expected graduation
- Major
- Discord username

**Related Code:**
- `supabase/migrations/20260721120000_forms_schema.sql` - forms schema

---

## Support & Ticket Data

### Support Tickets
- Ticket title and description
- Ticket category
- Priority level
- Status (in_progress, resolved, etc.)
- Created by user ID
- Updated by user ID
- Timestamps

**Related Code:**
- `tickets` table in Supabase

---

## Payment & Financial Data

### Payment Information
- Payment intent ID from Stripe
- Amount paid (in cents)
- Currency
- Payment status (completed, failed, refunded)
- Member ID associated with payment
- Stripe customer ID

### Membership Data
- Membership status (active, inactive, expired)
- Membership plan
- Payment due dates
- Renewal dates
- Shirt purchase status

### Finance Transactions (Internal Ledger)
- Transaction ID
- Account (member or sponsor)
- Category
- Amount
- Verified status
- Created by / Updated by
- Timestamps

**Related Code:**
- Stripe webhook handler: `app/api/stripe/webhook/route.ts`
- Finance tables: `supabase/migrations/20260804120000_finance_schema.sql`

**Third-party Sharing:** Stripe receives all payment information

---

## External API & Integration Data

### CodeCoogs External API Access
Shared via proxy at `app/api/codecoogs/[...path]/route.ts`

Data endpoint access includes:
- Point transactions (by email, ID, Discord ID)
- User points and totals
- Active members list
- Payment information
- Point categories

### Discord OAuth
When user authenticates or links Discord:
- Email address
- Discord user ID
- Discord username
- OAuth token (Supabase managed)

**Third-party Sharing:** Discord receives email and user ID

### Google Calendar Integration
When user authorizes calendar sync:
- Google OAuth token (Supabase managed)
- Event details synced to personal calendar
- RSVP status

**Third-party Sharing:** Google Calendar receives event data

### Stripe Integration
- All payment information (see Payment section above)
- Customer ID, email, name
- Transaction history
- Refund records

**Third-party Sharing:** Stripe receives all payment-related data

---

## Officer & Leadership Data

### Officer Profiles (Public)
- Name
- Bio/description
- Photo/profile picture
- LinkedIn URL
- Instagram URL
- Personal website URL
- Display order for officer directory

### Positions & Permissions
- User position/role (e.g., President, Vice President, Treasurer)
- Permissions associated with role
- Position assignment date

**Related Code:**
- `user_positions` table
- `positions` table
- `roles` table
- `position_permissions` table

---

## Browser/Client-Side Data

### Local Storage
- Theme preference (`coco-theme`)
  - Possible values: "system", "light", "dark", "latte", "pink-sorbet", "frappe", "macchiato", "mocha"
  - Stored for 365 days

### Cookies
- Session authentication cookies
- Third-party cookies from Stripe, Discord, Google

**Related Code:**
- `app/contexts/ThemeContext.tsx`

---

## Opportunities & Job Postings

### Opportunity Records
- Title and description
- Link/URL
- Category and icon
- Company name
- Location
- Employment type (Full-time, Part-time, Internship, Contract)
- Salary
- Source (manual entry or CSV import)
- External ID (for deduplication)

**Related Code:**
- `supabase/migrations/20260728120000_opportunities_schema_extend.sql`

**Note:** These are displayed publicly; CodeCoogs does not verify legitimacy

---

## Import/Bulk Operations

### CSV Imports Support
- Event attendance records
- User contact information
- Opportunity job listings

**Related Code:**
- `supabase/migrations/20260426124000_attendance_csv_import_and_unassigned_trigger.sql`

---

## Audit & Access Logging

### All Data Operations Track
- `created_by` - User ID who created the record
- `updated_by` - User ID who last updated the record
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update

**Purpose:** Security audit trail to track who accessed/modified what data

---

## Data Not Collected (Intentionally Omitted)

✅ Credit card numbers (handled by Stripe, not stored)  
✅ Social Security numbers  
✅ Birth dates (only graduation dates)  
✅ Personal health information  
✅ Political affiliation or beliefs  
✅ Biometric data  
✅ Location data (except event location preference)  
✅ Detailed browsing history  

---

## Data Retention Schedule

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| Active user profile | For life of account | Ongoing service |
| Event attendance | 2 years minimum | Historical records |
| Points/leaderboard | 2 years minimum | Historical records |
| Payment records | 7 years | IRS/legal requirement |
| Form responses | 1 year or per form policy | Organization records |
| Support tickets | 1 year | Legal protection |
| Login/audit logs | 90 days | Security monitoring |
| Deleted account data | 30 days (then purged) | Data deletion grace period |

---

## Data Subjects (Who Can Access What)

### Users Can Access Their Own:
- Profile information
- Event attendance history
- Points earned
- Form responses
- Support tickets
- Payment history
- All personal data (via "Download My Data")

### Officers Can Access:
- All user data (with permission controls)
- Aggregate statistics (points, attendance)
- Form responses (if admin of form)
- Payment status (finance officers only)
- Support tickets (support team only)

### Third Parties Can Access:
- Supabase: All data (as hosting provider)
- Stripe: Payment data only
- Discord: Email & user ID only
- Google: Event data only
- CodeCoogs API: Points, transactions, members

---

## Compliance Checklist

- [ ] All data collection points listed above are disclosed in Privacy Policy
- [ ] Users receive notice before data is collected
- [ ] Users can opt-out of non-essential data collection
- [ ] Data is retained only as long as necessary
- [ ] Users can request access to their data
- [ ] Users can request correction of inaccurate data
- [ ] Users can request deletion of their data
- [ ] Officers receive data handling training
- [ ] No data is sold or shared without consent
- [ ] Third-party vendors are vetted for security
- [ ] Data collection is minimized (only what's needed)

---

## How to Update This Document

When you add new features:

1. **New data collection?** → Add to this inventory
2. **New third-party integration?** → Update "External API" section
3. **Data retention change?** → Update retention schedule
4. **New field in profile?** → Add to "User Profile Data" section

**After updating:**
- Update Privacy Policy if scope changes
- Update Terms of Service if usage changes
- Notify users of significant changes
- Update implementation date in code

---

## Audit Trail

| Date | Change | Reason | Approved By |
|------|--------|--------|------------|
| 2026-08-07 | Initial inventory | Legal documentation | - |

---

**This document is a living record. Review and update at least annually or whenever significant code changes occur.**

**Last Audit Date:** August 7, 2026  
**Next Audit Due:** August 7, 2027
