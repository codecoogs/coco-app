'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface DeletionPendingBannerProps {
  deletionConfirmedAt: string | null
}

export function DeletionPendingBanner({
  deletionConfirmedAt,
}: DeletionPendingBannerProps) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!deletionConfirmedAt) return

    const confirmedDate = new Date(deletionConfirmedAt)
    const graceEndDate = new Date(
      confirmedDate.getTime() + 30 * 24 * 60 * 60 * 1000
    )
    const now = new Date()
    const diff = graceEndDate.getTime() - now.getTime()
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000))

    setDaysRemaining(Math.max(0, days))
  }, [deletionConfirmedAt])

  if (!deletionConfirmedAt || daysRemaining === null) {
    return null
  }

  return (
    <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-600 p-4 mb-6 rounded">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
            ⚠️ Your account is scheduled for deletion
          </h3>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200">
            {daysRemaining > 0 ? (
              <>
                Your account will be permanently deleted in{' '}
                <strong>{daysRemaining}</strong> day
                {daysRemaining !== 1 ? 's' : ''}.
              </>
            ) : (
              <>Your account is being deleted right now.</>
            )}
          </p>
          <p className="mt-2 text-xs text-red-700 dark:text-red-300">
            Deletion confirmed on{' '}
            {new Date(deletionConfirmedAt).toLocaleDateString()}. You can still
            cancel by emailing{' '}
            <a
              href="mailto:main@codecoogs.com"
              className="font-semibold underline hover:no-underline"
            >
              main@codecoogs.com
            </a>
          </p>
        </div>

        <Link
          href="/dashboard/settings/account-privacy"
          className="ml-4 flex-shrink-0 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
        >
          Manage
        </Link>
      </div>
    </div>
  )
}
