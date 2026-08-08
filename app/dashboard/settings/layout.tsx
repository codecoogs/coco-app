'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SettingsTab {
  label: string
  href: string
  icon: string
}

const tabs: SettingsTab[] = [
  {
    label: 'Profile',
    href: '/dashboard/settings/profile',
    icon: '👤',
  },
  {
    label: 'Account & Privacy',
    href: '/dashboard/settings/account-privacy',
    icon: '🔒',
  },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-8">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`pb-4 px-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  )
}
