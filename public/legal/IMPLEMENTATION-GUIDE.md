# Legal Documentation Implementation Guide

**For:** Development team  
**Purpose:** Step-by-step instructions to integrate legal notices into the application  
**Date:** August 7, 2026

This guide shows you exactly where and how to add legal disclosures to your application code.

---

## Phase 1: Setup (Required First)

### 1.1 Create Legal Routes
Create a `/legal` page that displays all legal documents:

```bash
# Create the legal page structure
mkdir -p app/legal
touch app/legal/page.tsx
```

**In `app/legal/page.tsx`:**
```tsx
import Link from 'next/link'

export default function LegalPage() {
  const documents = [
    { slug: 'privacy-policy', title: 'Privacy Policy' },
    { slug: 'terms-of-service', title: 'Terms of Service' },
    { slug: 'cookie-policy', title: 'Cookie Policy' },
    { slug: 'third-party-services', title: 'Third-Party Services' },
    { slug: 'data-access-request', title: 'Data Access & Deletion' },
    { slug: 'disclaimers', title: 'Disclaimers' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Legal & Privacy</h1>
      <ul className="space-y-3">
        {documents.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/legal/${doc.slug}`} className="text-blue-600 hover:underline">
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 1.2 Create Document Display Routes
Create individual routes for each policy:

```bash
# Create route for each document
mkdir -p app/legal/[slug]
touch app/legal/[slug]/page.tsx
```

**In `app/legal/[slug]/page.tsx`:**
```tsx
import fs from 'fs'
import path from 'path'
import ReactMarkdown from 'react-markdown'

export default async function LegalDocumentPage({ params }: { params: { slug: string } }) {
  const legalDir = path.join(process.cwd(), 'public/legal')
  const filePath = path.join(legalDir, `${params.slug}.md`)
  
  // Add .md if not present
  const actualPath = fs.existsSync(filePath) ? filePath : filePath.replace('.md', '') + '.md'
  
  if (!fs.existsSync(actualPath)) {
    return <div>Document not found</div>
  }

  const content = fs.readFileSync(actualPath, 'utf-8')

  return (
    <div className="max-w-4xl mx-auto p-6">
      <article className="prose prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>
      <div className="mt-8 text-sm text-gray-500">
        <p>Last Updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  )
}
```

### 1.3 Add Footer Links
Update your footer component to include legal links:

```tsx
// In your footer component
export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-4 gap-8">
          {/* ... other footer content ... */}
          
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/legal/privacy-policy" className="hover:text-blue-400">Privacy Policy</Link></li>
              <li><Link href="/legal/terms-of-service" className="hover:text-blue-400">Terms of Service</Link></li>
              <li><Link href="/legal/cookie-policy" className="hover:text-blue-400">Cookies</Link></li>
              <li><Link href="/legal/data-access-request" className="hover:text-blue-400">Data Requests</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
```

---

## Phase 2: Signup Flow (Critical)

### 2.1 Add Privacy Notice to SignUp Modal

**In `app/components/auth/SignUpModal.tsx`:**

Before the form fields, add:
```tsx
<div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
  <p className="text-sm text-gray-700">
    <strong>Privacy Notice:</strong> CodeCoogs collects your email, name, and Cougar Net ID to verify 
    you're a current UH student. <strong>We do not sell your data.</strong> See our{' '}
    <Link href="/legal/privacy-policy" className="text-blue-600 underline">
      Privacy Policy
    </Link>
    {' '}for details.
  </p>
</div>
```

### 2.2 Add Terms Acceptance Checkbox

Add to the signup form:
```tsx
<div className="space-y-4">
  {/* ... existing form fields ... */}
  
  <div className="flex items-start space-x-3">
    <input
      type="checkbox"
      id="agree-terms"
      required
      checked={agreeToTerms}
      onChange={(e) => setAgreeToTerms(e.target.checked)}
      className="mt-1"
    />
    <label htmlFor="agree-terms" className="text-sm text-gray-700">
      I agree to CodeCoogs'{' '}
      <Link href="/legal/terms-of-service" className="text-blue-600 underline" target="_blank">
        Terms of Service
      </Link>
      {' '}and{' '}
      <Link href="/legal/privacy-policy" className="text-blue-600 underline" target="_blank">
        Privacy Policy
      </Link>
    </label>
  </div>
  
  <button disabled={!agreeToTerms}>Create Account</button>
</div>
```

### 2.3 Update Signup Handler

```tsx
const handleSignup = async () => {
  if (!agreeToTerms) {
    alert('You must agree to the Terms of Service')
    return
  }
  
  // ... rest of signup logic
}
```

---

## Phase 3: Data Collection Notices

### 3.1 Phone Number Collection Notice

**In `app/dashboard/settings/ProfileDetailsSection.tsx`:**
```tsx
<div>
  <label>Phone Number (Optional)</label>
  <input type="tel" placeholder="Your phone number" />
  <p className="text-xs text-gray-500 mt-1">
    We collect your phone number to help you stay connected. See our{' '}
    <Link href="/legal/privacy-policy" className="text-blue-600">Privacy Policy</Link> for details.
  </p>
</div>
```

### 3.2 Discord Linking Notice

**Before Discord linking prompt:**
```tsx
<div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
  <p className="text-sm">
    Linking your Discord account allows seamless authentication. Your email will be shared with Discord. 
    See our{' '}
    <Link href="/legal/third-party-services" className="text-blue-600">
      Third-Party Services
    </Link>{' '}
    policy for details.
  </p>
</div>
```

### 3.3 Form File Upload Notice

**On forms that allow file uploads:**
```tsx
<div>
  <label>Upload File</label>
  <input type="file" />
  <p className="text-xs text-gray-500 mt-1">
    Files are stored securely and will be retained according to our{' '}
    <Link href="/legal/privacy-policy" className="text-blue-600">Privacy Policy</Link>.
  </p>
</div>
```

---

## Phase 4: Payment & Third-Party Integration Notices

### 4.1 Stripe Payment Notice

**Before payment form or checkout:**
```tsx
<div className="bg-blue-50 p-4 rounded mb-4">
  <p className="text-sm text-gray-700">
    <strong>Payment Information:</strong> Your payment information is processed securely by Stripe. 
    We never store your credit card details. See our{' '}
    <Link href="/legal/third-party-services" className="text-blue-600">
      Third-Party Services
    </Link>{' '}
    policy.
  </p>
</div>
```

### 4.2 Google Calendar Notice

**Before requesting Google Calendar permission:**
```tsx
<div className="bg-blue-50 p-4 rounded mb-4">
  <p className="text-sm">
    Connecting to Google Calendar will sync CodeCoogs events to your personal calendar. 
    See our{' '}
    <Link href="/legal/third-party-services" className="text-blue-600">
      Third-Party Services
    </Link>{' '}
    policy for details about data sharing.
  </p>
</div>
```

---

## Phase 5: Data Access & Deletion (Account Settings)

### 5.1 Add Data Management Section to Settings

**Create `app/dashboard/settings/DataManagementSection.tsx`:**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

export function DataManagementSection() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadData = async () => {
    setIsDownloading(true)
    try {
      const response = await fetch('/api/user/export-data', {
        method: 'GET',
      })
      const data = await response.json()
      
      // Create downloadable JSON file
      const element = document.createElement('a')
      element.setAttribute('href', `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`)
      element.setAttribute('download', `my-data-${new Date().toISOString().split('T')[0]}.json`)
      element.style.display = 'none'
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    } catch (error) {
      alert('Failed to download data. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action is permanent and cannot be undone.'
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await fetch('/api/user/delete-account', {
        method: 'POST',
      })
      // Redirect to home after deletion
      window.location.href = '/'
    } catch (error) {
      alert('Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Data Management</h2>
      
      <div className="bg-gray-50 p-6 rounded">
        <h3 className="font-semibold mb-2">Download Your Data</h3>
        <p className="text-gray-600 text-sm mb-4">
          Get a copy of all your personal data in JSON format. See our{' '}
          <Link href="/legal/data-access-request" className="text-blue-600 underline">
            Data Access Request policy
          </Link>.
        </p>
        <button
          onClick={handleDownloadData}
          disabled={isDownloading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {isDownloading ? 'Downloading...' : 'Download My Data'}
        </button>
      </div>

      <div className="bg-gray-50 p-6 rounded">
        <h3 className="font-semibold mb-2">Delete Your Account</h3>
        <p className="text-gray-600 text-sm mb-4">
          Permanently delete your account and all associated data (except financial records required by law).
          This action cannot be undone.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          {isDeleting ? 'Deleting...' : 'Delete My Account'}
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-sm">
        <p>
          Have questions about your data? See our{' '}
          <Link href="/legal/data-access-request" className="text-blue-600 underline">
            Data Access & Deletion guide
          </Link>.
        </p>
      </div>
    </div>
  )
}
```

### 5.2 Add API Endpoints for Data Export

**Create `app/api/user/export-data/route.ts`:**

```typescript
import { createServerSupabaseClient } from '@/utils/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch all user data
    const [profile, events, points, forms, tickets] = await Promise.all([
      supabase.from('users').select('*').eq('auth_id', user.id).single(),
      supabase.from('events_attendance').select('*').eq('user_id', user.id),
      supabase.from('point_transactions').select('*').eq('user_id', user.id),
      supabase.from('form_response_answers').select('*').eq('user_id', user.id),
      supabase.from('tickets').select('*').eq('created_by', user.id),
    ])

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      profile: profile.data,
      events_attendance: events.data,
      points: points.data,
      form_responses: forms.data,
      support_tickets: tickets.data,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
```

**Create `app/api/user/delete-account/route.ts`:**

```typescript
import { createServerSupabaseClient } from '@/utils/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Delete user data (keep financial records per privacy policy)
    await supabase.from('users').delete().eq('auth_id', user.id)
    await supabase.auth.admin.deleteUser(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
```

---

## Phase 6: Job Postings & Opportunities

### 6.1 Add Disclaimer to Opportunities Page

**On opportunities listing:**
```tsx
<div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
  <p className="text-sm text-red-800">
    <strong>Important:</strong> CodeCoogs does not verify job postings. Always verify employment 
    opportunities directly with the company. See our{' '}
    <Link href="/legal/disclaimers" className="text-red-600 underline">
      Disclaimers
    </Link>{' '}
    for more information.
  </p>
</div>
```

### 6.2 Add Verification Notice

```tsx
<div className="bg-yellow-50 p-3 rounded text-sm">
  <p>
    💡 <strong>Tip:</strong> Verify this opportunity directly with the company. 
    Don't provide personal information via email until you've confirmed the opportunity is legitimate.
  </p>
</div>
```

---

## Phase 7: Testing Checklist

### ✅ Verify Each Requirement

- [ ] Legal documents are accessible at `/legal` route
- [ ] Each document displays correctly and is readable
- [ ] Privacy notice appears on signup page
- [ ] Terms of Service checkbox is required on signup
- [ ] Data collection notices appear for sensitive fields
- [ ] Third-party integration notices appear before OAuth/payment
- [ ] Footer includes links to legal documents
- [ ] "Download My Data" button works and exports user data
- [ ] "Delete Account" button works and requires confirmation
- [ ] Job postings show disclaimer and verification notice
- [ ] All links to legal documents work correctly
- [ ] Mobile view is readable and functional
- [ ] Contact email is filled in on all documents

---

## Phase 8: Deployment

### Pre-Launch Checklist

1. **Update Contact Information**
   - Search for `[contact email]` in all files
   - Replace with your actual email address
   - Search for `[contact address]` and fill in if applicable

2. **Test in Production**
   - Test signup flow with privacy notice
   - Test payment with Stripe notice
   - Test data export
   - Verify all legal links work

3. **Inform Users**
   - Post announcement in Discord/social media about new policies
   - Send email to existing members about data practices
   - Brief officers on privacy commitments

4. **Documentation**
   - Store a copy of this implementation guide
   - Document when each phase was completed
   - Keep audit trail of policy updates

---

## Maintenance

### Quarterly
- [ ] Review all legal documents for accuracy
- [ ] Check that data practices match policies

### Annually
- [ ] Full audit of data collection points
- [ ] Update contact information if changed
- [ ] Review third-party service agreements

### When Code Changes
- [ ] New data collection? → Update Privacy Policy
- [ ] New third-party service? → Update Third-Party Services doc
- [ ] Changed data retention? → Update inventory
- [ ] New integrations? → Update appropriate docs

---

## Common Implementation Issues

**Issue:** Privacy notice text is cut off on mobile  
**Solution:** Use responsive text sizing and ensure proper padding

**Issue:** Data export API is too slow  
**Solution:** Implement pagination or async export email

**Issue:** Delete account button could be accidentally clicked  
**Solution:** Add confirmation modal with re-confirmation

**Issue:** Legal docs are outdated after code changes  
**Solution:** Set a quarterly review reminder and update in git

---

**Questions?** Refer back to `/public/legal/README.md` for policy details.

**Last Updated:** August 7, 2026
