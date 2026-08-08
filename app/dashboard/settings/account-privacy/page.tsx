import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DeleteAccountSection } from '../DeleteAccountSection'

export default async function AccountPrivacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.id) {
    redirect('/login?next=/dashboard/settings/account-privacy')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account & Privacy</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Manage your account security and data privacy
        </p>
      </div>

      <DeleteAccountSection />

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          Data Privacy
        </h2>
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
          CodeCoogs is committed to protecting your privacy and data.
        </p>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>✓ We do not sell your data</li>
          <li>✓ Your data is encrypted in transit and at rest</li>
          <li>✓ Only authorized officers have access to your information</li>
          <li>✓ You can download or delete your data anytime</li>
        </ul>
        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <a
            href="/legal/privacy-policy"
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Read our full Privacy Policy →
          </a>
        </div>
      </div>
    </div>
  )
}
