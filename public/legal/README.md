# CodeCoogs Legal Documentation

This directory contains the legal documents and policies for CodeCoogs. These documents protect both the organization and our users by clearly establishing terms of use, data handling practices, and legal rights.

## Documents Overview

### 1. **Privacy Policy** (`privacy-policy.md`)
**Purpose:** Explains what data we collect, how we use it, and who we share it with

**Key Points:**
- ✅ We do NOT sell user data
- Lists all data collection points (emails, Cougar Net IDs, names, majors, etc.)
- Explains third-party integrations (Stripe, Discord, Google Calendar)
- Describes data retention and user rights
- Should be the first document users read

**When to display:** On signup, before account creation, and in your footer/legal links

---

### 2. **Terms of Service** (`terms-of-service.md`)
**Purpose:** Establishes the legal relationship between CodeCoogs and users

**Key Points:**
- User responsibilities and conduct rules
- Account creation and termination policies
- Payment and refund terms
- Intellectual property rights
- Limitation of liability (we're a student org, not a company)
- Disclaimers about service availability

**When to display:** On signup acceptance and in footer links

---

### 3. **Cookie Policy** (`cookie-policy.md`)
**Purpose:** Explains what cookies and local storage we use

**Key Points:**
- We use localStorage only for theme preference (light/dark mode)
- Explains third-party cookies from Stripe, Discord, Google
- How to control/disable cookies in your browser
- Completely non-invasive - just remembers your UI preference

**When to display:** In footer links or when users manage privacy settings

---

### 4. **Third-Party Services** (`third-party-services.md`)
**Purpose:** Detailed breakdown of what data goes to which third-party service

**Third Parties Covered:**
- **Supabase** - Database hosting (all user data)
- **Stripe** - Payment processing (payment info)
- **Discord** - Authentication (email, username)
- **Google Calendar** - Event syncing (calendar events)
- **CodeCoogs External API** - Points/member data

**When to display:** In footer links, before users link Discord, before payments

---

### 5. **Data Access & Deletion Requests** (`data-access-request.md`)
**Purpose:** Explains how users can request access to, correct, or delete their data

**User Rights Covered:**
- How to download your data (in-app or via email)
- How to update your profile information
- How to permanently delete your account
- Timeline for responses (7 business days)
- What data is retained after deletion (financial records only)

**When to display:** In settings/account page, make this easily discoverable

---

### 6. **Disclaimers** (`disclaimers.md`)
**Purpose:** Important legal disclaimers about the nature of our service

**Key Points:**
- CodeCoogs is a student-led org, not a registered company
- We don't verify job postings
- Job/career advice is informational only
- No warranty on data security or availability
- We're not responsible for third-party services
- Liability is limited to $100

**When to display:** In footer links, on job postings page

---

## How to Implement These Legally

### Step 1: Update Contact Information

All documents reference `[contact email]` and `[contact address]`. **Replace these with:**
- Email: your organization's contact email
- Address: UH campus address or office location
- Phone: optional, but helpful

### Step 2: Create a Legal Links Page

Create a footer section or `/legal` page with links to:
```
- Privacy Policy
- Terms of Service
- Cookie Policy
- Third-Party Services
- Data Access Requests
- Disclaimers
```

### Step 3: Add to Signup Flow

**Before creating account:**
1. Display Terms of Service with a checkbox: "I agree to the Terms of Service"
2. Link to Privacy Policy for reference
3. Get explicit consent before storing data

**Example consent message:**
```
By creating an account, you agree to:
- Our Terms of Service (link)
- Our Privacy Policy (link)
- Our use of your data as described above
□ I agree to these terms
```

### Step 4: Make Data Access Easy

In your `/dashboard/settings` page, add:
- "Download my data" button (that exports as JSON/CSV)
- "Update my profile" link
- "Delete my account" button with confirmation

### Step 5: Update Your Application Code

You should update code to:
1. Show privacy notices before collecting data (especially before collecting Cougar Net ID)
2. Add a link to Privacy Policy in footer
3. Display data sharing notices before third-party integrations
4. Make it clear in forms what data is collected

**Example in SignUpModal.tsx:** Add a notice saying "We collect your email and Cougar Net ID. See our Privacy Policy for details. We do NOT sell your data."

---

## Key Legal Points

### What You MUST Do (LEGALLY REQUIRED)

✅ **Display Privacy Policy** - Users should see this before providing data  
✅ **Disclose Third-Party Sharing** - Tell users about Stripe, Discord, Google, etc.  
✅ **Get Consent** - Have users agree to terms before creating accounts  
✅ **Honor Data Requests** - Provide data, corrections, and deletions when requested  
✅ **Be Honest About Security** - Don't claim you're more secure than you are  

### What NOT to Do (AVOID LEGAL PROBLEMS)

❌ Don't hide data collection  
❌ Don't misrepresent security measures  
❌ Don't sell or share data without permission  
❌ Don't ignore data deletion requests  
❌ Don't claim to be more than a student organization  
❌ Don't make guarantees you can't keep  

---

## FAQ for Users

### "Why does CodeCoogs collect my Cougar Net ID?"
CodeCoogs collects Cougar Net ID to verify you're a current UH student and track participation. It's not used for anything else and is not sold.

### "Will you sell my data?"
No. We absolutely do not sell, rent, or trade user data to anyone.

### "Who has access to my data?"
- CodeCoogs officers (limited to what they need for their role)
- Supabase (our hosting provider, under contract)
- Third-party services only if you authorize them (Discord, Google Calendar)

### "Can I delete my account?"
Yes. You can request account deletion anytime, and your data will be deleted within 30 days (except financial records required by law).

### "What if CodeCoogs is hacked?"
While we take security seriously, we can't guarantee 100% protection. Avoid sharing passwords or sensitive financial info through the app.

---

## Implementation Checklist

- [ ] Replace `[contact email]` with your actual email address in all documents
- [ ] Replace `[contact address]` if provided
- [ ] Create a `/legal` page or footer with links to all policies
- [ ] Add privacy notice to signup flow
- [ ] Add "I agree to Terms of Service" checkbox on signup
- [ ] Add "Download my data" to account settings
- [ ] Add "Delete my account" option with confirmation
- [ ] Test that users can access and understand the policies
- [ ] Add links to policies in footer of website
- [ ] Brief your officers on what these policies mean
- [ ] Keep a record of when policies were implemented

---

## Notes for Officers & Maintainers

1. **These policies are not legal advice.** If you have specific legal questions, consult with a lawyer.

2. **Keep data practices aligned with policies.** If your code collects data not mentioned in the Privacy Policy, update the policy or change the code.

3. **Respond to data requests.** If someone emails asking for their data, you must respond within 7 business days (set in `data-access-request.md`).

4. **Review annually.** Legal requirements change. Review these policies once a year to ensure they're still accurate.

5. **Preserve audit trail.** Keep records of when policies were updated and who requested what data (for legal protection).

6. **Third-party changes.** If you add new third-party services (analytics, CRM, etc.), update `third-party-services.md` and notify users.

---

## File Structure

```
public/legal/
├── README.md (this file)
├── privacy-policy.md
├── terms-of-service.md
├── cookie-policy.md
├── third-party-services.md
├── data-access-request.md
└── disclaimers.md
```

---

**Last Updated:** August 7, 2026  
**Status:** Ready for implementation  
**Next Review:** August 7, 2027
