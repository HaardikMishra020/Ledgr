import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className = '', as: Tag = 'div', onClick, hoverable = false }: CardProps) {
  return (
    <Tag
      onClick={onClick}
      className={[
        'bg-surface-card rounded-lg border border-outline-variant shadow-card',
        hoverable && 'hover:shadow-card-hover hover:border-outline transition-all duration-150 cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  )
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-card py-card ${className}`}>{children}</div>
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start justify-between px-card pt-card pb-3 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
        {subtitle && <p className="text-xs text-on-surface-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}

export function CardDivider() {
  return <div className="border-t border-outline-variant" />
}
