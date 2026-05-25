'use client'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'

interface TopNavProps {
  displayName?: string
  onSignOut?: () => void
}

export function TopNav({ displayName, onSignOut }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 bg-surface-card border-b border-outline-variant">
      <div className="max-w-2xl mx-auto px-container h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/dashboard" className="font-bold text-xl tracking-tight text-primary select-none">
          Ledgr
        </Link>

        {/* Right side */}
        {displayName && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={displayName} size="sm" />
              <span className="text-sm font-medium text-on-surface hidden sm:block">{displayName}</span>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="text-xs text-on-surface-muted hover:text-on-surface transition-colors px-2 py-1"
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

interface PageHeaderProps {
  title: string
  onBack?: () => void
  action?: React.ReactNode
  badge?: React.ReactNode
}

export function PageHeader({ title, onBack, action, badge }: PageHeaderProps) {
  return (
    <div className="bg-surface-card border-b border-outline-variant">
      <div className="max-w-2xl mx-auto px-container h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="shrink-0 text-on-surface-muted hover:text-on-surface transition-colors p-1 -ml-1 rounded"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 5L7 10L12 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <h1 className="font-semibold text-on-surface truncate">{title}</h1>
          {badge}
        </div>
        {action && <div className="shrink-0 ml-4">{action}</div>}
      </div>
    </div>
  )
}
