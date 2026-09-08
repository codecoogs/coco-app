# Third-Party Services & Data Sharing

**Effective Date:** August 7, 2026  
**Last Updated:** August 7, 2026

CodeCoogs uses several third-party services to operate our platform. This document explains what data is shared with each service and why.

## Third-Party Services We Use

### 1. Supabase (Data Hosting & Database)

**What they do:** Hosts our user database and application data  
**Data shared:**
- All user profile information
- Event attendance records
- Points and leaderboard data
- Form responses and submissions
- Payment tracking information
- File uploads (avatars, form attachments)

**Their privacy policy:** https://supabase.com/privacy  
**Our relationship:** Service provider - they process data on our behalf under a data processing agreement

---

### 2. Stripe (Payment Processing)

**What they do:** Processes membership payments and donations  
**Data shared:**
- Payment method information (name, card number, email)
- Email address
- Membership status
- Transaction amounts and dates
- Member/sponsor identifiers for record-keeping

**What they do NOT receive:** Your Cougar Net ID, academic information, or personal interests

**Their privacy policy:** https://stripe.com/privacy  
**Our relationship:** Service provider - payments are encrypted and PCI-DSS compliant

**Security:** Stripe never stores full credit card numbers on our servers. All payment data is securely tokenized.

---

### 3. Discord (Authentication & Account Linking)

**What they do:** Allows you to sign in with Discord and link your Discord account  
**Data shared when you authenticate:**
- Email address
- Discord username and user ID
- OAuth token (for linking)

**What they do NOT receive:** Your password, Cougar Net ID, or other profile information

**Their privacy policy:** https://discord.com/privacy  
**Our relationship:** Authentication provider & optional account linking

**Optional:** Linking Discord is optional. You can use email/password login instead.

---

### 4. Google Calendar (Event Integration)

**What they do:** Syncs our events to your personal Google Calendar  
**Data shared when you authorize:**
- Event title and description
- Event date, time, and location
- Google Calendar API tokens for syncing

**What they do NOT receive:** Your email address or personal calendar data

**Their privacy policy:** https://policies.google.com/privacy  
**Our relationship:** Optional integration - you must authorize this connection

**Optional:** Using Google Calendar integration is optional.

---

### 5. CodeCoogs External API

**What they do:** Provides supplementary data about points, transactions, and members  
**Data shared:**
- User email addresses
- User IDs
- Discord usernames (if linked)
- Points earned and activity history
- Membership status

**Their privacy policy:** Available at their service documentation  
**Our relationship:** Data integration partner

**Note:** This is CodeCoogs' own external service, operated separately from the website/app.

---

## How We Protect Your Data

1. **Encryption in Transit:** All data sent to third parties uses HTTPS encryption
2. **Encryption at Rest:** Sensitive data is encrypted in our database
3. **Access Control:** Only authorized staff can access your data
4. **Data Minimization:** We only share data necessary for each service to function
5. **No Selling:** We do not sell your data to any third party

## Your Rights Regarding Third-Party Services

You have the right to:
- Disable Discord linking and use email/password instead
- Remove Google Calendar integration at any time
- Request that we delete your account (which removes data sharing)
- Review which services have access to your data

## Data Retention by Third Parties

Third-party services retain data according to their own policies. CodeCoogs is not responsible for their data retention practices. If you want to ensure deletion from a third party's systems, you may need to contact them directly.

### To Delete Your Data:

**From Stripe:** Contact their support; they typically retain data per PCI requirements (7 years)  
**From Discord:** Access Discord Settings → Privacy & Safety → Delete Account  
**From Google:** Manage your Google Account settings

## Changes & Additions

If CodeCoogs begins using additional third-party services, we will:
1. Update this document
2. Notify affected users
3. Obtain consent if required by privacy regulations

## Questions About Third-Party Services?

For questions about data sharing:

**CodeCoogs**  
4465 UNIVERSITY DRIVE MAILBOX 355  
HOUSTON TX 77204  
Email: main@codecoogs.com

---

*Last Updated: August 7, 2026*
