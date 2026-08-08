'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ConfirmDeletionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [step, setStep] = useState<'verifying' | 'confirm' | 'processing' | 'success' | 'error'>(
    'verifying'
  )
  const [wantBackup, setWantBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No deletion token provided. Invalid confirmation link.')
      setStep('error')
    } else {
      setStep('confirm')
    }
  }, [token])

  // Note: Token validation happens server-side in the API route
  // The link will be valid only if:
  // 1. Token exists in deleted_users table
  // 2. Status is 'pending'
  // 3. Created less than 24 hours ago

  const handleConfirmDeletion = async () => {
    setStep('processing')
    setError(null)

    try {
      const response = await fetch('/api/user/confirm-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deletionId: token,
          exportBackup: wantBackup,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm deletion')
      }

      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('error')
    }
  }

  if (step === 'verifying') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your deletion request...</p>
        </div>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Confirm Account Deletion</h1>

          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
            <p className="text-red-800 text-sm">
              ⚠️ <strong>This is your final step.</strong> Once confirmed, your account will
              be marked for deletion and you'll be logged out.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="backup"
                checked={wantBackup}
                onChange={(e) => setWantBackup(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="backup" className="text-sm text-gray-700">
                Export my data as JSON before deletion
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleConfirmDeletion}
              disabled={step === 'processing'}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {step === 'processing' ? 'Confirming...' : 'Confirm Deletion'}
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 bg-gray-300 text-gray-900 py-2 px-4 rounded hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            This link is valid for 24 hours.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your deletion...</p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">✓ Account Deletion Confirmed</h1>

          <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
            <p className="text-green-800 text-sm">
              Your account has been marked for deletion. You have <strong>30 days</strong> to
              cancel if you change your mind.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <p className="text-blue-800 text-sm mb-3">
              <strong>What happens next:</strong>
            </p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• You've been logged out</li>
              <li>• Your data will be deleted in 30 days</li>
              <li>• Payment records kept for 7 years (tax law)</li>
              <li>• Admins can restore your account anytime during 30 days</li>
            </ul>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 text-sm mb-2">
              Need to cancel? Email us within 30 days:
            </p>
            <a
              href="mailto:main@codecoogs.com?subject=Cancel%20Account%20Deletion"
              className="text-blue-600 hover:underline text-sm font-semibold"
            >
              main@codecoogs.com
            </a>
          </div>

          <Link
            href="/"
            className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">❌ Error</h1>

          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>

          <p className="text-gray-600 text-sm mb-6">
            If you need help, please email us at{' '}
            <a href="mailto:main@codecoogs.com" className="text-blue-600 underline">
              main@codecoogs.com
            </a>
          </p>

          <Link
            href="/"
            className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  return null
}
