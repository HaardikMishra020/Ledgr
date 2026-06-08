'use client'

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { getAccessToken } from '@/lib/auth'
import {
  getMe,
  getGroup,
  getGroupMembers,
  getGroupBalancesDetail,
  getGroupActivity,
  getGroupSettlement,
  deleteExpense,
  archiveGroup,
} from '@/lib/api'
import type { Me, Group, Member, GroupEvent, GroupSettlement } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(minorUnits: number, currency: string): string {
  const major = Math.abs(minorUnits) / 100
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${major.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtShort(minorUnits: number, currency: string): string {
  const major = Math.abs(minorUnits) / 100
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${major.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

// dateIso  → determines the label (Today / Yesterday / DD Mon)
// timeIso  → determines the HH:MM clock display (defaults to dateIso)
// Keeping them separate: occurred_at gives the correct calendar date;
// created_at gives the actual wall-clock time the expense was logged.
function formatDate(dateIso: string, timeIso?: string): string {
  const d = new Date(dateIso)
  const t = timeIso ? new Date(timeIso) : d
  const now = new Date()
  const todayStr = now.toDateString()
  const dStr = d.toDateString()
  const yesterdayStr = new Date(now.getTime() - 86400000).toDateString()
  const hh = t.getHours().toString().padStart(2, '0')
  const mm = t.getMinutes().toString().padStart(2, '0')
  const time = `${hh}:${mm}`
  if (dStr === todayStr) return `Today, ${time}`
  if (dStr === yesterdayStr) return `Yesterday, ${time}`
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  return `${day} ${month}, ${time}`
}

type Category = 'Food' | 'Transport' | 'Stay' | 'Shopping' | 'Other'

function inferCategory(description: string): Category {
  const d = description.toLowerCase()
  if (/taxi|uber|ola|auto|cab|bus|train|flight|car|transport/.test(d)) return 'Transport'
  if (/food|dinner|lunch|breakfast|restaurant|cafe|meal|snack|biryani|pizza/.test(d)) return 'Food'
  if (/hotel|villa|stay|accommodation|room|hostel|airbnb/.test(d)) return 'Stay'
  if (/shop|market|mall|buy|purchase/.test(d)) return 'Shopping'
  return 'Other'
}

function categoryIcon(cat: Category): string {
  switch (cat) {
    case 'Transport': return 'local_taxi'
    case 'Food':      return 'restaurant'
    case 'Stay':      return 'hotel'
    case 'Shopping':  return 'shopping_cart'
    default:          return 'receipt_long'
  }
}

// ── Derived expense type ─────────────────────────────────────────────────────

type ActiveExpense = {
  expense_id: string
  amount: number
  currency: string
  fx_to_default: string  // rate from expense currency → group default currency, locked at record time
  paid_by: string
  split: Array<{ user_id: string; share: string }>
  description: string
  occurred_at: string
  created_at: string   // when the expense_added event was recorded — stable sort tiebreaker
  category: Category
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = String(params.groupId)

  const [me, setMe] = useState<Me | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [balancesRaw, setBalancesRaw] = useState<Record<string, Record<string, number>>>({})
  const [activity, setActivity] = useState<GroupEvent[]>([])
  const [settlement, setSettlement] = useState<GroupSettlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'All' | 'Food' | 'Transport'>('All')

  const loadData = useCallback(async () => {
    try {
      const [meData, groupData, membersData, balancesData, activityData, settlementData] =
        await Promise.all([
          getMe(),
          getGroup(groupId),
          getGroupMembers(groupId),
          getGroupBalancesDetail(groupId),
          getGroupActivity(groupId, 100),
          getGroupSettlement(groupId),
        ])
      setMe(meData)
      setGroup(groupData)
      setMembers(membersData)
      setBalancesRaw(balancesData.balances)
      setActivity(activityData)
      setSettlement(settlementData)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'UNAUTHORIZED') router.replace('/login')
        else setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [router, groupId])

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }
    loadData()
  }, [router, groupId, loadData])

  // WebSocket: reload data whenever the backend publishes a group event
  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    const wsBase = apiBase.replace(/^http/, 'ws')
    let ws: WebSocket
    let closed = false

    function connect() {
      ws = new WebSocket(`${wsBase}/groups/${groupId}/ws?token=${token}`)
      ws.onmessage = () => { loadData() }
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      closed = true
      ws?.close()
    }
  }, [groupId, loadData])

  async function handleDeleteExpense(expenseId: string) {
    if (!confirm('Delete this expense? This cannot be undone.')) return
    try {
      await deleteExpense(groupId, expenseId)
      await loadData()
    } catch {
      // keep UI intact on failure
    }
  }

  async function handleArchiveGroup() {
    if (!confirm(`Archive "${group?.name}"? Members can no longer add expenses.`)) return
    try {
      await archiveGroup(groupId)
      router.push('/dashboard')
    } catch {
      // keep UI intact on failure
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const memberMap = useMemo(
    () => Object.fromEntries(members.map(m => [m.user_id, m])),
    [members],
  )

  const { expenses, totalGroupSpending, youSpent } = useMemo(() => {
    const active = new Map<string, ActiveExpense>()
    for (const ev of activity) {
      if (ev.event_type === 'expense_added' || ev.event_type === 'expense_edited') {
        const p = ev.payload
        const desc = String(p.description ?? '')
        const existing = active.get(String(p.expense_id))
        active.set(String(p.expense_id), {
          expense_id: String(p.expense_id),
          amount: Number(p.amount),
          currency: String(p.currency ?? group?.default_currency ?? 'INR'),
          fx_to_default: String(p.fx_to_default ?? '1'),
          paid_by: String(p.paid_by),
          split: (p.split as Array<{ user_id: string; share: string }>) ?? [],
          description: desc,
          occurred_at: String(p.occurred_at ?? ev.created_at),
          // Preserve original add time; edits don't change when the expense was created
          created_at: existing?.created_at ?? ev.created_at,
          category: inferCategory(desc),
        })
      } else if (ev.event_type === 'expense_deleted') {
        active.delete(String(ev.payload.expense_id))
      }
    }
    const list = Array.from(active.values()).sort((a, b) => {
      const byOccurred = new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      if (byOccurred !== 0) return byOccurred
      // Stable tiebreaker: when the expense was actually added to the system
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    const toDefault = (e: ActiveExpense) => Math.round(e.amount * parseFloat(e.fx_to_default))
    const total = list.reduce((s, e) => s + toDefault(e), 0)
    const mySpend = list
      .filter(e => me && e.paid_by === me.id)
      .reduce((s, e) => s + toDefault(e), 0)
    return { expenses: list, totalGroupSpending: total, youSpent: mySpend }
  }, [activity, me, group])

  const { myNet, currency } = useMemo(() => {
    const cur = group?.default_currency ?? 'INR'
    if (!me) return { myNet: 0, currency: cur }
    const myBalances = balancesRaw[me.id] ?? {}
    const net = Object.values(myBalances).reduce((s, v) => s + v, 0)
    return { myNet: net, currency: cur }
  }, [balancesRaw, me, group])

  const memberBalances = useMemo(() => {
    if (!me || !settlement) return []
    return settlement.transactions
      .filter(t => t.from_user === me.id || t.to_user === me.id)
      .map(t => ({
        memberId: t.from_user === me.id ? t.to_user : t.from_user,
        amount: t.amount,
        currency: t.currency,
        // to_user is the creditor (receives money) → they are owed → "owes_me"
        direction: (t.to_user === me.id ? 'owes_me' : 'i_owe') as 'owes_me' | 'i_owe',
      }))
  }, [settlement, me])

  const timelineExpenses = useMemo(() =>
    activeFilter === 'All'
      ? expenses
      : expenses.filter(e => e.category === activeFilter),
    [expenses, activeFilter],
  )

  // ── Loading / not-found states ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-secondary text-4xl">
          progress_activity
        </span>
      </div>
    )
  }

  if (notFound || !group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant">
          group_off
        </span>
        <p className="text-headline-md text-primary">Group not found</p>
        <Link href="/dashboard" className="text-secondary font-bold hover:underline">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const firstTwoMembers = members.slice(0, 2)
  const extraMembers = Math.max(0, members.length - 2)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active="groups" addExpenseHref={`/dashboard/${groupId}/new-expense`} />

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-background pb-20 md:pb-0">
        {/* Top App Bar */}
        <header className="flex justify-between items-center px-container-padding h-16 w-full sticky top-0 z-40 glass-effect border-b border-outline-variant shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {group.icon && <span className="text-xl flex-shrink-0">{group.icon}</span>}
              <h2 className="text-base md:text-headline-md font-bold text-primary truncate max-w-[160px] sm:max-w-xs md:max-w-none">{group.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-gutter">
            {/* Currency badge */}
            <div className="hidden lg:flex items-center bg-surface-container-high px-4 py-2 rounded-full gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                currency_exchange
              </span>
              <span className="text-label-md">{currency}</span>
            </div>

            {/* Member avatar stack */}
            {members.length > 0 && (
              <div className="flex items-center -space-x-2 mr-2">
                {firstTwoMembers.map(m => (
                  <div
                    key={m.user_id}
                    className="w-8 h-8 rounded-full border-2 border-surface bg-secondary-container text-on-secondary-container flex items-center justify-center text-[10px] font-bold"
                    title={m.display_name}
                  >
                    {m.display_name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {extraMembers > 0 && (
                  <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-highest flex items-center justify-center text-[10px] font-bold">
                    +{extraMembers}
                  </div>
                )}
              </div>
            )}

            {/* Archive — owner only, desktop only (mobile uses bottom nav) */}
            {group?.created_by === me?.id && group?.status === 'active' && (
              <button
                onClick={handleArchiveGroup}
                className="hidden md:flex p-2 hover:bg-error/10 rounded-full transition-colors text-on-surface-variant hover:text-error"
                title="Archive group"
              >
                <span className="material-symbols-outlined">archive</span>
              </button>
            )}
            <Link
              href="/dashboard"
              className="hidden md:flex p-2 hover:bg-surface-container-high rounded-full transition-colors"
              title="Back to Dashboard"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
          </div>
        </header>

        {/* Content grid */}
        <div className="p-container-padding grid grid-cols-1 lg:grid-cols-12 gap-gutter">

          {/* ── Left column: Overview + Timeline ──────────────────────── */}
          <div className="lg:col-span-8 space-y-gutter">

            {/* Group Overview Card */}
            <div className="bg-white rounded-xl border border-outline-variant p-card-padding shadow-sm flex flex-wrap items-center justify-between gap-gutter">
              <div className="space-y-1">
                <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Group Balance</p>
                <h3 className="text-amount-display font-amount-display text-primary">
                  {fmtAmount(totalGroupSpending, currency)}
                </h3>
                <p className="text-body-md text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  {expenses.length} expense{expenses.length !== 1 ? 's' : ''} tracked
                </p>
              </div>
              <div className="flex gap-element-gap">
                <div className="text-center px-4 py-2 bg-surface-container-low rounded-lg">
                  <p className="text-label-md text-on-surface-variant">You Paid</p>
                  <p className="font-bold">{fmtShort(youSpent, currency)}</p>
                </div>
                <div className="text-center px-4 py-2 bg-surface-container-low rounded-lg">
                  {myNet >= 0 ? (
                    <>
                      <p className="text-label-md text-on-surface-variant">You Are Owed</p>
                      <p className="font-bold text-secondary">{fmtShort(myNet, currency)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-label-md text-on-surface-variant">You Owe</p>
                      <p className="font-bold text-on-tertiary-container">{fmtShort(Math.abs(myNet), currency)}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Expense Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-headline-md text-primary">Timeline</h4>
                <div className="flex gap-2">
                  {(['All', 'Food', 'Transport'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1 rounded-full text-label-md cursor-pointer transition-colors ${
                        activeFilter === f
                          ? 'bg-surface-container-high'
                          : 'border border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {timelineExpenses.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-on-surface-variant gap-3">
                  <span className="material-symbols-outlined text-4xl">receipt_long</span>
                  <p className="text-body-md">
                    {activeFilter === 'All'
                      ? 'No expenses yet — add one to get started!'
                      : `No ${activeFilter} expenses found.`}
                  </p>
                </div>
              ) : (
                timelineExpenses.map((expense, idx) => (
                  <div
                    key={expense.expense_id}
                    className="relative pl-8 pb-8 border-l-2 border-outline-variant last:border-l-0"
                  >
                    <div
                      className={`absolute top-0 rounded-full border-4 border-background flex items-center justify-center ${
                        idx === 0
                          ? '-left-[11px] w-5 h-5 bg-secondary'
                          : '-left-[9px] w-4 h-4 bg-outline-variant'
                      }`}
                    />
                    <p className="text-label-md text-on-surface-variant mb-2">
                      {formatDate(expense.occurred_at, expense.created_at)}
                    </p>
                    <ExpenseCard
                      expense={expense}
                      meId={me?.id ?? ''}
                      memberMap={memberMap}
                      groupId={groupId}
                      onDelete={handleDeleteExpense}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right column: Balances + Members ──────────────────────── */}
          <div className="lg:col-span-4 space-y-gutter">

            {/* Balances Panel */}
            <div id="balances-section" className="bg-surface-container rounded-xl p-card-padding border border-outline-variant">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-headline-md text-primary">Balances</h4>
              </div>

              {memberBalances.length === 0 ? (
                <div className="py-6 flex flex-col items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl text-secondary">check_circle</span>
                  <p className="text-body-md font-bold text-secondary">All settled up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberBalances.map(({ memberId, amount, currency: txCur, direction }) => {
                    const member = memberMap[memberId]
                    if (!member) return null
                    return (
                      <div
                        key={memberId}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-outline-variant"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-bold text-on-surface-variant">
                            {member.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-body-md font-bold">{member.display_name}</p>
                            <p className={`text-label-md ${direction === 'owes_me' ? 'text-secondary' : 'text-on-tertiary-container'}`}>
                              {direction === 'owes_me' ? 'owes you' : 'you owe'}
                            </p>
                          </div>
                        </div>
                        <p className={`font-amount-display text-headline-md ${direction === 'owes_me' ? 'text-secondary' : 'text-on-tertiary-container'}`}>
                          {fmtShort(amount, txCur)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              <Link
                href="/settlements"
                className="block w-full mt-6 py-2 border-2 border-secondary text-secondary font-bold rounded-lg hover:bg-secondary/5 transition-colors active:scale-95 text-center"
              >
                Settle Up
              </Link>
            </div>

            {/* Members Panel */}
            <div id="members-section" className="bg-surface-container rounded-xl p-card-padding border border-outline-variant">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-headline-md text-primary">Members</h4>
                <span className="text-label-md text-on-surface-variant">{members.length}</span>
              </div>
              <div className="space-y-3">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-bold text-on-surface-variant flex-shrink-0">
                      {m.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md font-bold truncate">{m.display_name}</p>
                      <p className="text-label-md text-on-surface-variant capitalize">{m.role}</p>
                    </div>
                    {m.user_id === me?.id && (
                      <span className="text-label-md text-secondary font-bold flex-shrink-0">You</span>
                    )}
                  </div>
                ))}
              </div>
              <Link
                href={`/dashboard/${groupId}/add-members`}
                className="w-full mt-5 py-2 border border-outline-variant text-on-surface-variant font-bold rounded-lg hover:bg-surface-container-high transition-colors text-label-md flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                Invite Member
              </Link>
            </div>
          </div>

        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant px-6 py-3 flex justify-between items-center z-50">
        <button
          className="flex flex-col items-center gap-1 text-on-surface-variant"
          onClick={() => router.push('/dashboard')}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-[10px]">Back</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-on-surface-variant"
          onClick={() => document.getElementById('members-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="material-symbols-outlined">group</span>
          <span className="text-[10px]">Members</span>
        </button>
        <Link
          href={`/dashboard/${groupId}/new-expense`}
          className="flex flex-col items-center -mt-8"
        >
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-on-primary shadow-lg border-4 border-background">
            <span className="material-symbols-outlined">add</span>
          </div>
          <span className="text-[10px] mt-1 font-bold">Add</span>
        </Link>
        <button
          className="flex flex-col items-center gap-1 text-on-surface-variant"
          onClick={() => document.getElementById('balances-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="material-symbols-outlined">account_balance_wallet</span>
          <span className="text-[10px]">Balances</span>
        </button>
        {group.created_by === me?.id && group.status === 'active' ? (
          <button
            className="flex flex-col items-center gap-1 text-on-surface-variant"
            onClick={handleArchiveGroup}
          >
            <span className="material-symbols-outlined">archive</span>
            <span className="text-[10px]">Archive</span>
          </button>
        ) : (
          <button
            className="flex flex-col items-center gap-1 text-on-surface-variant"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span className="material-symbols-outlined">expand_less</span>
            <span className="text-[10px]">Top</span>
          </button>
        )}
      </nav>
    </div>
  )
}

// ── ExpenseCard ──────────────────────────────────────────────────────────────

function ExpenseCard({
  expense,
  meId,
  memberMap,
  groupId,
  onDelete,
}: {
  expense: ActiveExpense
  meId: string
  memberMap: Record<string, Member>
  groupId: string
  onDelete: (expenseId: string) => void
}) {
  const paidByName =
    expense.paid_by === meId
      ? 'You'
      : memberMap[expense.paid_by]?.display_name ?? 'Someone'

  const myShare = expense.split.find(s => s.user_id === meId)
  const myShareAmount = myShare ? Number(myShare.share) : null

  const iOwe = expense.paid_by !== meId && myShareAmount !== null && myShareAmount > 0
  const iAmOwedAmount =
    expense.paid_by === meId && myShareAmount !== null && expense.split.length > 1
      ? expense.amount - myShareAmount
      : null

  const icon = categoryIcon(expense.category)

  return (
    <div className="bg-white rounded-xl border border-outline-variant p-card-padding shadow-sm hover:shadow-md transition-shadow group tonal-elevation">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary flex-shrink-0">
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div className="min-w-0">
            <h5 className="font-headline-md text-primary group-hover:text-secondary transition-colors truncate">
              {expense.description}
            </h5>
            <p className="text-body-md text-on-surface-variant">
              Paid by <span className="font-semibold">{paidByName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <div className="text-right">
            <p className="text-headline-md font-amount-display">
              {fmtShort(expense.amount, expense.currency)}
            </p>
            {iOwe && myShareAmount !== null && (
              <p className="text-label-md text-on-tertiary-container">
                You owe {fmtShort(myShareAmount, expense.currency)}
              </p>
            )}
            {iAmOwedAmount !== null && (
              <p className="text-label-md text-secondary">
                You are owed {fmtShort(iAmOwedAmount, expense.currency)}
              </p>
            )}
            {!iOwe && iAmOwedAmount === null && (
              <p className="text-label-md text-on-surface-variant">
                Split ({expense.split.length} {expense.split.length === 1 ? 'person' : 'people'})
              </p>
            )}
          </div>
          {/* Edit / Delete actions — visible on hover */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link
              href={`/dashboard/${groupId}/edit-expense/${expense.expense_id}`}
              className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors"
              title="Edit expense"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
            </Link>
            <button
              onClick={() => onDelete(expense.expense_id)}
              className="w-8 h-8 rounded-full hover:bg-error/10 flex items-center justify-center transition-colors"
              title="Delete expense"
            >
              <span className="material-symbols-outlined text-[18px] text-error">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
