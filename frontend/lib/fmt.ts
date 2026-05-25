export function fmtAmount(minor: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(2)} ${ccy}`
  }
}

export function amountColorClass(minor: number): string {
  if (minor > 0) return 'text-owed'
  if (minor < 0) return 'text-owing'
  return 'text-on-surface-muted'
}

export function amountBgClass(minor: number): string {
  if (minor > 0) return 'bg-owed-bg border-owed-border'
  if (minor < 0) return 'bg-owing-bg border-owing-border'
  return 'bg-surface-low border-outline-variant'
}
