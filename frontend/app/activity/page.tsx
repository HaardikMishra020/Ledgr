'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { getAccessToken } from '@/lib/auth'
import { getMe, getGlobalActivity } from '@/lib/api'
import type { Me, RichActivityEvent } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'

// ── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ',
}

function fmtAmount(minorUnits: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  const major = Math.abs(minorUnits) / 100
  return `${sym}${major.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function inferIcon(description: string): string {
  const d = description.toLowerCase()
  if (/food|dinner|lunch|breakfast|restaurant|pizza|cafe|chai|meal|snack/.test(d)) return 'restaurant'
  if (/flight|air|indigo|spicejet|vistara|plane/.test(d)) return 'flight'
  if (/hotel|stay|resort|airbnb|oyo|hostel/.test(d)) return 'hotel'
  if (/grocery|groceries|vegetable|fruit|market|supermarket/.test(d)) return 'shopping_bag'
  if (/movie|netflix|prime|ott|show|concert|ticket|entertainment/.test(d)) return 'movie'
  if (/medicine|pharmacy|doctor|hospital|health|medical/.test(d)) return 'medical_services'
  if (/electricity|wifi|internet|water|gas|rent|bill|utility/.test(d)) return 'receipt_long'
  if (/uber|ola|taxi|cab|auto|bus|train|metro/.test(d)) return 'directions_car'
  if (/shop|shopping|amazon|flipkart|clothes|shoes/.test(d)) return 'shopping_cart'
  return 'receipt_long'
}

function dateGroupLabel(isoStr: string): string {
  const d = new Date(isoStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today.getTime() - 86_400_000)
  const eventDay = new Date(d)
  eventDay.setHours(0, 0, 0, 0)
  if (eventDay.getTime() === today.getTime()) return 'Today'
  if (eventDay.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const d = new Date(isoStr)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

type EventTypeFilter = 'all' | 'expenses' | 'payments'

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time',     days: 0 },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [events, setEvents] = useState<RichActivityEvent[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [limit, setLimit] = useState(30)
  const [hasMore, setHasMore] = useState(true)

  // Filter state
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterType, setFilterType] = useState<EventTypeFilter>('all')
  const [filterDays, setFilterDays] = useState(30)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }

    async function load() {
      try {
        const [meData, evts] = await Promise.all([getMe(), getGlobalActivity(limit)])
        setMe(meData)
        setEvents(evts)
        setHasMore(evts.length >= limit)
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHORIZED') router.replace('/login')
        // on any other error, keep existing events intact — do not wipe state
      } finally {
        setInitialLoading(false)
        setLoadingMore(false)
      }
    }
    load()
  }, [router, limit])

  function handleLoadMore() {
    setLoadingMore(true)
    setLimit(prev => prev + 20)
  }

  // Unique groups derived from events (for filter dropdown)
  const groups = useMemo(() => {
    const map = new Map<string, string>()
    events.forEach(e => map.set(e.group_id, e.group_name))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [events])

  // Client-side filtering
  const filtered = useMemo(() => {
    const cutoff = filterDays > 0 ? Date.now() - filterDays * 86_400_000 : 0
    return events.filter(ev => {
      if (filterGroup !== 'all' && ev.group_id !== filterGroup) return false
      if (filterType === 'expenses' && !ev.event_type.startsWith('expense_')) return false
      if (filterType === 'payments' && !ev.event_type.startsWith('payment_')) return false
      if (filterDays > 0 && new Date(ev.created_at).getTime() < cutoff) return false
      if (search) {
        const q = search.toLowerCase()
        const desc = String(ev.payload.description ?? '').toLowerCase()
        if (
          !desc.includes(q) &&
          !ev.group_name.toLowerCase().includes(q) &&
          !ev.actor_display_name.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [events, filterGroup, filterType, filterDays, search])

  // Group filtered events by calendar date label
  const grouped = useMemo(() => {
    const map = new Map<string, RichActivityEvent[]>()
    for (const ev of filtered) {
      const label = dateGroupLabel(ev.created_at)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(ev)
    }
    return Array.from(map.entries())
  }, [filtered])

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-secondary text-4xl">
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="activity" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top App Bar ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-background border-b border-outline-variant shadow-sm flex justify-between items-center px-container-padding h-16">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">Activity</h1>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                search
              </span>
              <input
                className="bg-surface-container border-none rounded-full pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-secondary transition-all text-body-md"
                placeholder="Search activities..."
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {me && (
              <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold border-2 border-outline-variant overflow-hidden flex-shrink-0">
                {me.avatar_url ? (
                  <img src={me.avatar_url} alt={me.display_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-label-md">{me.display_name.charAt(0).toUpperCase()}</span>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="flex-1 px-container-padding py-6 max-w-7xl mx-auto w-full space-y-gutter pb-24 md:pb-8">

          {/* Filters */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding tonal-elevation flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="font-label-md text-label-md text-on-surface-variant">GROUP</label>
              <select
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
                className="bg-surface-container border-none rounded-lg px-3 py-2 text-body-md focus:ring-2 focus:ring-secondary outline-none"
              >
                <option value="all">All Groups</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="font-label-md text-label-md text-on-surface-variant">TYPE</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as EventTypeFilter)}
                className="bg-surface-container border-none rounded-lg px-3 py-2 text-body-md focus:ring-2 focus:ring-secondary outline-none"
              >
                <option value="all">All Activities</option>
                <option value="expenses">Expenses</option>
                <option value="payments">Payments</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="font-label-md text-label-md text-on-surface-variant">DATE RANGE</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-body-md">
                  calendar_today
                </span>
                <select
                  value={filterDays}
                  onChange={e => setFilterDays(Number(e.target.value))}
                  className="w-full bg-surface-container border-none rounded-lg pl-9 pr-3 py-2 text-body-md focus:ring-2 focus:ring-secondary outline-none"
                >
                  {DATE_RANGE_OPTIONS.map(r => (
                    <option key={r.days} value={r.days}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="space-y-8">
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
                <span className="material-symbols-outlined text-5xl mb-3">receipt_long</span>
                <p className="font-body-lg text-body-lg text-on-surface-variant">No activity found</p>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  {search || filterGroup !== 'all' || filterType !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Expenses and payments will appear here'}
                </p>
              </div>
            ) : (
              <>
                {grouped.map(([label, evts]) => (
                  <div key={label}>
                    <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-3">
                      {label}
                      <div className="h-[1px] flex-1 bg-outline-variant" />
                    </h3>
                    <div className="space-y-3">
                      {evts.map(ev => (
                        <ActivityItem key={ev.id} event={ev} meId={me?.id ?? ''} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Load more */}
                <div className="py-8 flex flex-col items-center justify-center gap-4">
                  {hasMore ? (
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-8 py-3 border border-outline text-on-surface font-semibold rounded-lg hover:bg-surface-container transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className={`material-symbols-outlined ${loadingMore ? 'animate-spin' : ''}`}>
                        {loadingMore ? 'progress_activity' : 'refresh'}
                      </span>
                      {loadingMore ? 'Loading…' : 'Load More Activity'}
                    </button>
                  ) : (
                    <p className="font-label-md text-label-md text-on-surface-variant opacity-60">
                      You&apos;ve reached the end
                    </p>
                  )}
                  <p className="font-label-md text-label-md text-on-surface-variant opacity-60">
                    Showing {filtered.length} activit{filtered.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface border-t border-outline-variant shadow-lg flex justify-around items-center px-4 py-3">
        <Link href="/dashboard" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors">
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-md text-label-md">Home</span>
        </Link>
        <div className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-4 py-1">
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="font-label-md text-label-md">Activity</span>
        </div>
        <Link href="/friends" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md">Friends</span>
        </Link>
        <Link href="/dashboard" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors">
          <span className="material-symbols-outlined">group</span>
          <span className="font-label-md text-label-md">Groups</span>
        </Link>
      </nav>
    </div>
  )
}

// ── ActivityItem ─────────────────────────────────────────────────────────────

function ActivityItem({ event: ev, meId }: { event: RichActivityEvent; meId: string }) {
  const isMe = ev.actor_user_id === meId
  const actorName = isMe ? 'You' : ev.actor_display_name
  const p = ev.payload

  // ── Expense added / edited ────────────────────────────────────────────────
  if (ev.event_type === 'expense_added' || ev.event_type === 'expense_edited') {
    const desc = String(p.description ?? 'Expense')
    const amount = Number(p.amount)
    const currency = String(p.currency ?? 'INR')
    const paidBy = String(p.paid_by ?? '')
    const split = (p.split as Array<{ user_id: string; share: string }>) ?? []
    const myShare = split.find(s => s.user_id === meId)
    const myShareMinor = myShare ? Number(myShare.share) : null
    const iOwe = paidBy !== meId && myShareMinor !== null && myShareMinor > 0
    const iAmOwedMinor =
      paidBy === meId && myShareMinor !== null && split.length > 1
        ? amount - myShareMinor
        : null
    const verb = ev.event_type === 'expense_added' ? 'added' : 'updated'

    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 tonal-elevation flex items-center gap-4 hover:border-secondary transition-all cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container flex-shrink-0">
          <span className="material-symbols-outlined">{inferIcon(desc)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body-md text-body-md text-on-surface">
            <span className="font-bold">{actorName}</span>
            {' '}{verb}{' '}
            &ldquo;{desc}&rdquo; in{' '}
            <Link href={`/dashboard/${ev.group_id}`} className="text-secondary font-semibold hover:underline">
              {ev.group_name}
            </Link>
          </p>
          <span className="font-label-md text-label-md text-on-surface-variant">
            {relativeTime(ev.created_at)}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-body-lg">{fmtAmount(amount, currency)}</div>
          {iOwe && myShareMinor !== null && (
            <div className="font-label-md text-label-md text-on-tertiary-container">
              Your share: <span className="font-bold">{fmtAmount(myShareMinor, currency)}</span>
            </div>
          )}
          {iAmOwedMinor !== null && (
            <div className="font-label-md text-label-md text-on-surface-variant">
              You are owed:{' '}
              <span className="font-bold text-secondary">{fmtAmount(iAmOwedMinor, currency)}</span>
            </div>
          )}
          {!iOwe && iAmOwedMinor === null && myShareMinor !== null && (
            <div className="font-label-md text-label-md text-on-surface-variant">Split equally</div>
          )}
        </div>
      </div>
    )
  }

  // ── Expense deleted ───────────────────────────────────────────────────────
  if (ev.event_type === 'expense_deleted') {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 tonal-elevation flex items-center gap-4 hover:border-secondary transition-all cursor-pointer opacity-70">
        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant flex-shrink-0">
          <span className="material-symbols-outlined">delete</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body-md text-body-md text-on-surface">
            <span className="font-bold">{actorName}</span>
            {' '}deleted an expense in{' '}
            <Link href={`/dashboard/${ev.group_id}`} className="text-secondary font-semibold hover:underline">
              {ev.group_name}
            </Link>
          </p>
          <span className="font-label-md text-label-md text-on-surface-variant">
            {relativeTime(ev.created_at)}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="material-symbols-outlined text-outline">chevron_right</span>
        </div>
      </div>
    )
  }

  // ── Payment made / confirmed ──────────────────────────────────────────────
  if (ev.event_type === 'payment_made' || ev.event_type === 'payment_confirmed') {
    const amount = Number(p.amount)
    const currency = String(p.currency ?? 'INR')
    const fromId = String(p.from ?? '')
    const toId = String(p.to ?? '')
    const isReceiver = toId === meId

    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 tonal-elevation flex items-center gap-4 hover:border-secondary transition-all cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant flex-shrink-0">
          <span className="material-symbols-outlined">payments</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body-md text-body-md text-on-surface">
            {fromId === meId ? (
              <><span className="font-bold">You</span> made a payment in </>
            ) : isReceiver ? (
              <><span className="font-bold">{ev.actor_display_name}</span> paid you in </>
            ) : (
              <><span className="font-bold">{actorName}</span> made a payment in </>
            )}
            <Link href={`/dashboard/${ev.group_id}`} className="text-secondary font-semibold hover:underline">
              {ev.group_name}
            </Link>
          </p>
          <span className="font-label-md text-label-md text-on-surface-variant">
            {relativeTime(ev.created_at)}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`font-bold text-body-lg ${isReceiver ? 'text-secondary' : ''}`}>
            {isReceiver ? '+ ' : ''}{fmtAmount(amount, currency)}
          </div>
          <div className="font-label-md text-label-md text-secondary font-bold">Settled</div>
        </div>
      </div>
    )
  }

  // ── Payment initiated (pending) ───────────────────────────────────────────
  if (ev.event_type === 'payment_initiated') {
    const amount = Number(p.amount)
    const currency = String(p.currency ?? 'INR')
    const toId = String(p.to ?? '')
    const isReceiver = toId === meId

    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 tonal-elevation flex items-center gap-4 hover:border-secondary transition-all cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant flex-shrink-0">
          <span className="material-symbols-outlined">pending</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body-md text-body-md text-on-surface">
            {isReceiver ? (
              <><span className="font-bold">{ev.actor_display_name}</span> sent you a payment request in </>
            ) : (
              <><span className="font-bold">{actorName}</span> initiated a payment in </>
            )}
            <Link href={`/dashboard/${ev.group_id}`} className="text-secondary font-semibold hover:underline">
              {ev.group_name}
            </Link>
          </p>
          <span className="font-label-md text-label-md text-on-surface-variant">
            {relativeTime(ev.created_at)}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-body-lg">{fmtAmount(amount, currency)}</div>
          <div className="font-label-md text-label-md text-on-surface-variant">Pending</div>
        </div>
      </div>
    )
  }

  // ── Fallback for future event types ──────────────────────────────────────
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 tonal-elevation flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant flex-shrink-0">
        <span className="material-symbols-outlined">info</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body-md text-body-md text-on-surface">
          <span className="font-bold">{actorName}</span>
          {' '}in{' '}
          <Link href={`/dashboard/${ev.group_id}`} className="text-secondary font-semibold hover:underline">
            {ev.group_name}
          </Link>
        </p>
        <span className="font-label-md text-label-md text-on-surface-variant">
          {relativeTime(ev.created_at)}
        </span>
      </div>
    </div>
  )
}
