'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAccessToken } from '@/lib/auth'
import { getMe, getGroupBalances, getGlobalActivity } from '@/lib/api'
import type { Me, GroupBalance, RichActivityEvent } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtAmount(minorUnits: number, currency: string): string {
  const major = Math.abs(minorUnits) / 100
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${major.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function describeEvent(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'expense_added':   return `added "${payload.description}"`
    case 'expense_edited':  return `updated "${payload.description}"`
    case 'expense_deleted': return 'removed an expense'
    case 'payment_made':
    case 'payment_confirmed': return 'settled a payment'
    case 'payment_initiated': return 'initiated a payment'
    default: return eventType.replace(/_/g, ' ')
  }
}

function eventIcon(eventType: string): string {
  switch (eventType) {
    case 'expense_added':     return 'add'
    case 'expense_edited':    return 'edit'
    case 'expense_deleted':   return 'delete'
    case 'payment_made':
    case 'payment_confirmed': return 'check'
    case 'payment_initiated': return 'schedule'
    default:                  return 'info'
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [groups, setGroups] = useState<GroupBalance[]>([])
  const [activityFeed, setActivityFeed] = useState<RichActivityEvent[]>([])
  const [latestByGroup, setLatestByGroup] = useState<Record<string, RichActivityEvent>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }

    async function load() {
      try {
        const meData = await getMe()
        const [groupsData, activityData] = await Promise.all([
          getGroupBalances(meData.default_currency),
          getGlobalActivity(20),
        ])
        setMe(meData)
        setGroups(groupsData)

        // Build latest-event-per-group map (feed is sorted newest-first, so first occurrence = latest)
        const latest: Record<string, RichActivityEvent> = {}
        for (const ev of activityData) {
          if (!latest[ev.group_id]) latest[ev.group_id] = ev
        }
        setLatestByGroup(latest)

        // Global feed: already newest-first, keep top 8
        setActivityFeed(activityData.slice(0, 8))
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHORIZED') {
          router.replace('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  // Derived totals — use FX-converted summary balances in user's default currency
  const primaryCurrency = me?.default_currency ?? groups[0]?.summary_currency ?? 'INR'
  const totalOwed = groups.reduce((s, g) => s + Math.max(0, g.net_balance_summary), 0)
  const totalOwes = groups.reduce((s, g) => s + Math.max(0, -g.net_balance_summary), 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-secondary text-4xl">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="dashboard" />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Top App Bar */}
        <header className="flex justify-between items-center px-container-padding h-16 w-full bg-surface dark:bg-surface-dim border-b border-outline-variant dark:border-outline shadow-sm dark:shadow-none top-0 sticky z-10">
          <div className="flex items-center gap-gutter">
            <div className="flex items-center bg-surface-container px-4 py-2 rounded-full md:w-96">
              <span className="material-symbols-outlined text-on-surface-variant" data-icon="search">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-body-md w-full ml-2"
                placeholder="Search expenses or groups"
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container flex items-center justify-center">
              {me?.avatar_url ? (
                <img alt={me.display_name} src={me.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <span className="text-label-md font-bold text-on-surface-variant">
                  {me?.display_name?.charAt(0).toUpperCase() ?? '?'}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-container-padding space-y-8 max-w-7xl mx-auto w-full">

          {/* Summary Bento */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            <div className="md:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding tonal-elevation flex flex-col justify-between min-h-[160px]">
              <div>
                <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Total Balance Summary</p>
                <h2 className="text-headline-lg font-headline-lg">
                  Welcome back, {me?.display_name ?? '—'}
                </h2>
              </div>
              <div className="flex items-center gap-12 mt-4">
                <div>
                  <p className="text-label-md font-label-md text-on-surface-variant">You are owed</p>
                  <p className="text-amount-display font-amount-display text-secondary">
                    {totalOwed > 0 ? fmtAmount(totalOwed, primaryCurrency) : '—'}
                  </p>
                </div>
                <div className="w-px h-12 bg-outline-variant"></div>
                <div>
                  <p className="text-label-md font-label-md text-on-surface-variant">You owe</p>
                  <p className="text-amount-display font-amount-display text-on-tertiary-container">
                    {totalOwes > 0 ? fmtAmount(totalOwes, primaryCurrency) : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary text-on-primary rounded-xl p-card-padding tonal-elevation flex flex-col justify-center items-center text-center gap-4 relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary opacity-10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <span
                className="material-symbols-outlined text-4xl"
                data-icon="account_balance_wallet"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                account_balance_wallet
              </span>
              <div>
                <h3 className="text-headline-md font-headline-md mb-1">Quick Settle</h3>
                <p className="text-body-md opacity-80 px-4">Clear your dues with a single click</p>
              </div>
              <button
                disabled={totalOwes === 0}
                onClick={() => router.push('/settlements')}
                className="w-full bg-secondary text-on-secondary py-3 rounded-lg font-label-md hover:scale-[1.02] transition-transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {totalOwes > 0
                  ? `Settle ${fmtAmount(totalOwes, primaryCurrency)} Now`
                  : 'Nothing to settle'}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Active Groups Grid */}
            <div id="groups-section" className="lg:col-span-8 space-y-gutter">
              <div className="flex justify-between items-center">
                <h3 className="text-headline-md font-headline-md">Active Groups</h3>
                <span className="text-label-md text-on-surface-variant">{groups.length} active</span>
              </div>

              {groups.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <CreateGroupCard />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  {groups.map((g) => (
                    <GroupCard
                      key={g.group_id}
                      group={g}
                      lastEvent={latestByGroup[g.group_id] ?? null}
                    />
                  ))}
                  <CreateGroupCard />
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div className="lg:col-span-4 space-y-gutter">
              <div className="flex justify-between items-center">
                <h3 className="text-headline-md font-headline-md">Activity Feed</h3>
                <button className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined" data-icon="more_horiz">more_horiz</span>
                </button>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden tonal-elevation">
                {activityFeed.length === 0 ? (
                  <div className="p-card-padding text-center text-on-surface-variant text-body-md">
                    No activity yet. Add an expense to get started.
                  </div>
                ) : (
                  <>
                    <div className="p-card-padding space-y-6">
                      {activityFeed.map((ev) => (
                        <ActivityItem key={ev.id} event={ev} />
                      ))}
                    </div>
                    <Link
                      href="/activity"
                      className="block w-full py-4 bg-surface-container-low text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors text-center"
                    >
                      View Full History
                    </Link>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <BottomNav active="dashboard" />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function GroupCard({ group, lastEvent }: { group: GroupBalance; lastEvent: RichActivityEvent | null }) {
  const isPositive = group.net_balance >= 0
  const amountText = group.net_balance === 0
    ? '—'
    : `${isPositive ? '+ ' : '- '}${fmtAmount(group.net_balance, group.currency)}`

  return (
    <Link href={`/dashboard/${group.group_id}`} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding tonal-elevation hover:border-secondary transition-all cursor-pointer group block">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center">
          {group.icon ? (
            <span className="text-2xl">{group.icon}</span>
          ) : (
            <span className="text-headline-md font-bold text-primary">
              {group.group_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-label-md font-label-md text-on-surface-variant">Your balance</p>
          <p className={`text-headline-md font-headline-md ${isPositive ? 'text-secondary' : 'text-on-tertiary-container'}`}>
            {amountText}
          </p>
        </div>
      </div>
      <h4 className="text-headline-md font-headline-md mb-1">{group.group_name}</h4>
      <p className="text-body-md text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-base" data-icon="update">update</span>
        {lastEvent
          ? describeEvent(lastEvent.event_type, lastEvent.payload)
          : 'No activity yet'}
      </p>
    </Link>
  )
}

function CreateGroupCard() {
  return (
    <Link href="/dashboard/new-group" className="border-2 border-dashed border-outline-variant rounded-xl p-card-padding flex flex-col items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer group">
      <span className="material-symbols-outlined text-3xl mb-2 group-hover:scale-110 transition-transform" data-icon="add_circle">add_circle</span>
      <p className="font-label-md">Create New Group</p>
    </Link>
  )
}

function ActivityItem({ event }: { event: RichActivityEvent }) {
  const icon = eventIcon(event.event_type)
  const actionText = describeEvent(event.event_type, event.payload)
  const detail = `${timeAgo(event.created_at)} • ${event.group_name}`
  const isSettlement = event.event_type === 'payment_made' || event.event_type === 'payment_confirmed'
  const amount = isSettlement
    ? fmtAmount(Number(event.payload.amount ?? 0), String(event.payload.currency ?? 'INR'))
    : null

  return (
    <div className="flex gap-4">
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-base" data-icon={icon}>{icon}</span>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-secondary rounded-full p-1 border-2 border-white">
          <span
            className="material-symbols-outlined text-[10px] text-on-secondary"
            data-icon={icon}
            style={{ fontWeight: 700 }}
          >
            {icon}
          </span>
        </div>
      </div>
      <div>
        <p className="text-body-md">
          <span className="font-bold">{event.actor_display_name}</span>{' '}
          {actionText}
        </p>
        <p className="text-label-md text-on-surface-variant">{detail}</p>
        {amount && (
          <div className="mt-1 px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed-variant rounded-full text-[10px] font-bold w-fit">
            + {amount}
          </div>
        )}
      </div>
    </div>
  )
}
