const PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const sizeCls = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
}

interface AvatarProps {
  name: string
  size?: keyof typeof sizeCls
  className?: string
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  return (
    <div
      className={`${sizeCls[size]} ${pickColor(name)} rounded-full flex items-center justify-center font-semibold shrink-0 select-none ${className}`}
    >
      {initials(name)}
    </div>
  )
}

interface AvatarGroupProps {
  names: string[]
  max?: number
  size?: keyof typeof sizeCls
}

export function AvatarGroup({ names, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visible = names.slice(0, max)
  const overflow = names.length - max
  return (
    <div className="flex -space-x-2">
      {visible.map((name, i) => (
        <Avatar key={i} name={name} size={size} className="ring-2 ring-surface-card" />
      ))}
      {overflow > 0 && (
        <div
          className={`${sizeCls[size]} bg-surface-variant text-on-surface-muted rounded-full flex items-center justify-center text-xs font-semibold ring-2 ring-surface-card`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
