import React from 'react'

type Variant = 'default' | 'owed' | 'owing' | 'warning' | 'error' | 'archived' | 'owner' | 'live' | 'offline'

const variantCls: Record<Variant, string> = {
  default:   'bg-surface-variant text-on-surface-muted',
  owed:      'bg-owed-bg text-owed-dim border border-owed-border',
  owing:     'bg-owing-bg text-owing-dim border border-owing-border',
  warning:   'bg-amber-50 text-amber-700 border border-amber-200',
  error:     'bg-error-bg text-error border border-error-border',
  archived:  'bg-surface-variant text-on-surface-muted',
  owner:     'bg-primary/10 text-primary',
  live:      'bg-owed-bg text-owed-dim border border-owed-border',
  offline:   'bg-surface-variant text-on-surface-muted',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  dot?: boolean
  className?: string
}

export function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label font-semibold uppercase tracking-wide ${variantCls[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${variant === 'live' ? 'bg-owed' : variant === 'offline' ? 'bg-on-surface-muted' : 'bg-current'}`}
        />
      )}
      {children}
    </span>
  )
}
