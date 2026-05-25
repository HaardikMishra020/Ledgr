import React from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'outline' | 'teal'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variantCls: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-fg hover:bg-primary-dim active:bg-primary-container',
  ghost:
    'border border-owed text-owed hover:bg-owed-bg active:bg-owed-bg',
  danger:
    'bg-owing text-white hover:bg-owing-dim active:bg-owing-dim',
  outline:
    'border border-outline-variant text-on-surface hover:bg-surface-low active:bg-surface-variant',
  teal:
    'bg-owed text-white hover:bg-owed-dim active:bg-owed-dim',
}

const sizeCls: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded',
  md: 'px-4 py-2.5 text-sm font-semibold rounded-lg',
  lg: 'px-5 py-3 text-sm font-semibold rounded-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={[
        'inline-flex items-center justify-center transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantCls[variant],
        sizeCls[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading…
        </span>
      ) : children}
    </button>
  )
}
