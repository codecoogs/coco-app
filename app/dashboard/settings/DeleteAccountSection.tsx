'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function DeleteAccountSection() {
  const router = useRouter()
  const [step, setStep] = useState<'initial' | 'confirm' | 'requesting' | 'email-sent'>(
    'initial'
  )
  const [wantBackup, setWantBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletionId, setDeletionId] = useState<string | null>(null)

  const handleRequestDeletion = async () => {
    setStep('requesting')
    setError(null)

    try {
      const response = await fetch('/api/user/request-deletion', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request deletion')
      }

      setDeletionId(data.deletionId)
      setStep('email-sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('confirm')
    }
  }

  if (step === 'initial') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Delete Account</h2>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-semibold text-red-900 mb-4">⚠️ Danger Zone</h3>
          <p className="text-red-800 mb-4">
            Deleting your account is permanent. Here's what happens:
          </p>
          <ul className="list-disc list-inside space-y-2 text-red-800 mb-6">
            <li>You'll be logged out immediately</li>
            <li>Your profile and data will be marked for deletion</li>
            <li>You have 30 days to cancel if you change your mind</li>
            <li>After 30 days, all data is permanently deleted</li>
            <li>Your payment records are kept for 7 years (tax requirement)</li>
          </ul>

          <button
            onClick={() => setStep('confirm')}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Delete My Account
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            Before deleting, you can export a backup of your data (optional). See our{' '}
            <Link href="/legal/data-access-request" className="font-semibold underline">
              Data Access policy
            </Link>{' '}
            for details.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Confirm Account Deletion</h2>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-4">⚠️ This Cannot Be Undone</h3>
          <p className="text-yellow-800 mb-6">
            You're about to permanently delete your CodeCoogs account. You'll receive a
            confirmation email with a link to confirm this action.
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="confirm-delete"
                required
                className="mt-1"
              />
              <label htmlFor="confirm-delete" className="text-yellow-900">
                I understand that my account will be permanently deleted
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="backup-option"
                checked={wantBackup}
                onChange={(e) => setWantBackup(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="backup-option" className="text-yellow-900">
                Export a backup of my data as JSON before deletion (optional)
              </label>
            </div>
          </div>

          {wantBackup && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-6">
              <p className="text-sm text-blue-800">
                ✓ We'll export all your personal data (profile, event history, points,
                form responses) as a JSON file that you can download.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleRequestDeletion}
              disabled={step === 'requesting'}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {step === 'requesting' ? 'Processing...' : 'Send Confirmation Email'}
            </button>
            <button
              onClick={() => setStep('initial')}
              className="bg-gray-300 text-gray-900 px-6 py-2 rounded hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>
            Check your email for a confirmation link. You must click it within 24 hours
            to confirm the deletion. See our{' '}
            <Link href="/legal/data-access-request" className="text-blue-600 underline">
              Data Deletion Policy
            </Link>{' '}
            for details.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'email-sent') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Confirmation Email Sent</h2>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-4">✓ Check Your Email</h3>
          <p className="text-green-800 mb-6">
            We've sent a confirmation link to your email address.
            <strong> You must click the link to confirm your account deletion.</strong>
          </p>

          <div className="bg-white border border-green-200 rounded p-4 mb-6">
            <p className="text-sm text-gray-700 mb-3">
              <strong>What happens next:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Click the link in your confirmation email</li>
              {wantBackup && (
                <li>Download your data backup (JSON file)</li>
              )}
              <li>Your account will be marked for deletion</li>
              <li>You'll be logged out</li>
              <li>Data will be permanently deleted after 30 days</li>
              <li>You can cancel anytime during the 30-day period</li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> If you don't see the email, check your spam folder.
            </p>
          </div>

          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <p>
            Deletion ID: <code className="bg-gray-100 px-2 py-1 rounded">{deletionId}</code>
          </p>
          <p className="mt-2">
            Questions? See our{' '}
            <Link href="/legal/data-access-request" className="text-blue-600 underline">
              Data Access & Deletion policy
            </Link>
            {' '}or email us at{' '}
            <a href="mailto:main@codecoogs.com" className="text-blue-600 underline">
              main@codecoogs.com
            </a>
          </p>
        </div>
      </div>
    )
  }

  return null
}
