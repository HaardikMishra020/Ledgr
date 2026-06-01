'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'

type ActiveItem = 'dashboard' | 'groups' | 'activity' | 'friends' | 'settlements' | 'settings'

interface SidebarProps {
  active: ActiveItem
  addExpenseHref?: string
}

const NAV_ITEMS: { id: ActiveItem; icon: string; label: string; href: string }[] = [
  { id: 'dashboard',   icon: 'grid_view',    label: 'Dashboard',   href: '/dashboard' },
  { id: 'activity',    icon: 'receipt_long',  label: 'Activity',    href: '/activity' },
  { id: 'friends',     icon: 'person',        label: 'Friends',     href: '/friends' },
  { id: 'settlements', icon: 'payments',      label: 'Settlements', href: '/settlements' },
]

export default function Sidebar({ active, addExpenseHref }: SidebarProps) {
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col py-8 px-4 gap-4 h-screen w-72 left-0 top-0 sticky bg-surface-container-low border-r border-outline-variant shadow-sm z-50">
      <div className="flex items-center gap-3 mb-6 px-4">
        <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-white">account_balance_wallet</span>
        </div>
        <div>
          <h1 className="text-headline-md font-headline-md font-bold text-primary leading-tight">Ledgr</h1>
          <p className="text-label-md font-label-md text-on-surface-variant">Fiscal Clarity</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(item =>
          item.id === active ? (
            <span key={item.id} className="bg-secondary-container text-on-secondary-container rounded-lg px-4 py-2 flex items-center gap-3 translate-x-1">
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-body-md font-bold">{item.label}</span>
            </span>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className="text-on-surface-variant px-4 py-2 flex items-center gap-3 hover:bg-surface-container-high transition-all duration-200 rounded-lg"
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-body-md">{item.label}</span>
            </Link>
          )
        )}
      </nav>

      {addExpenseHref && (
        <div className="mt-4 px-4">
          <Link
            href={addExpenseHref}
            className="w-full bg-primary text-on-primary py-3 rounded-lg font-headline-md flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Add Expense
          </Link>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1 border-t border-outline-variant pt-3">
        {active === 'settings' ? (
          <span className="bg-secondary-container text-on-secondary-container rounded-lg px-4 py-2 flex items-center gap-3 translate-x-1">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-body-md font-bold">Settings</span>
          </span>
        ) : (
          <Link
            href="/profile"
            className="text-on-surface-variant px-4 py-2 flex items-center gap-3 hover:bg-surface-container-high transition-all duration-200 rounded-lg"
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="font-body-md">Settings</span>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="text-on-surface-variant px-4 py-2 flex items-center gap-3 hover:bg-surface-container-high transition-all duration-200 rounded-lg w-full text-left"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-body-md">Log out</span>
        </button>
      </div>
    </aside>
  )
}
