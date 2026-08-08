import { redirect } from 'next/navigation'

export default function SettingsPage() {
  // Redirect to profile tab by default
  redirect('/dashboard/settings/profile')
}
