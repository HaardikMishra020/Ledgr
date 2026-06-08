'use client'

import Link from 'next/link'

type ActiveTab = 'dashboard' | 'activity' | 'friends' | 'profile' | 'settlements'

interface BottomNavProps {
  active: ActiveTab
  fab?: { href: string; label: string }
}

const LEFT_TABS = [
  { id: 'dashboard' as ActiveTab, icon: 'grid_view',    label: 'Dashboard', href: '/dashboard' },
  { id: 'activity'  as ActiveTab, icon: 'receipt_long', label: 'Activity',  href: '/activity' },
]

const RIGHT_TABS = [
  { id: 'friends' as ActiveTab, icon: 'group',  label: 'Friends', href: '/friends' },
  { id: 'profile' as ActiveTab, icon: 'person', label: 'Profile', href: '/profile' },
]

const DEFAULT_FAB = { href: '/dashboard/new-group', label: 'New' }

export default function BottomNav({ active, fab = DEFAULT_FAB }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant px-6 py-3 flex justify-between items-center z-50">
      {LEFT_TABS.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`flex flex-col items-center gap-1 ${active === tab.id ? 'text-secondary' : 'text-on-surface-variant'}`}
        >
          <span
            className="material-symbols-outlined"
            style={active === tab.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {tab.icon}
          </span>
          <span className={`text-[10px] ${active === tab.id ? 'font-bold' : ''}`}>{tab.label}</span>
        </Link>
      ))}

      {/* Center FAB */}
      <Link href={fab.href} className="flex flex-col items-center -mt-8">
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-on-primary shadow-lg border-4 border-background">
          <span className="material-symbols-outlined">add</span>
        </div>
        <span className="text-[10px] mt-1 font-bold">{fab.label}</span>
      </Link>

      {RIGHT_TABS.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`flex flex-col items-center gap-1 ${active === tab.id ? 'text-secondary' : 'text-on-surface-variant'}`}
        >
          <span
            className="material-symbols-outlined"
            style={active === tab.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {tab.icon}
          </span>
          <span className={`text-[10px] ${active === tab.id ? 'font-bold' : ''}`}>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
