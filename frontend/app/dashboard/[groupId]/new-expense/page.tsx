'use client'

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { getAccessToken } from '@/lib/auth'
import { getMe, getGroup, getGroupMembers, addExpense } from '@/lib/api'
import type { Me, Group, Member } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED']

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ',
}

const CATEGORIES = [
  { id: 'Food',      icon: 'restaurant',       label: 'Food' },
  { id: 'Travel',    icon: 'flight',            label: 'Travel' },
  { id: 'Home',      icon: 'home',              label: 'Home' },
  { id: 'Health',    icon: 'medical_services',  label: 'Health' },
  { id: 'Shopping',  icon: 'shopping_cart',     label: 'Shopping' },
  { id: 'Other',     icon: 'receipt_long',      label: 'Other' },
] as const

type CategoryId = typeof CATEGORIES[number]['id']

// ── Helper ───────────────────────────────────────────────────────────────────

function fmtMajor(minorUnits: number, symbol: string): string {
  const major = minorUnits / 100
  return `${symbol} ${major.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewExpensePage() {
  const router = useRouter()
  const params = useParams()
  const groupId = String(params.groupId)
  const backHref = `/dashboard/${groupId}`

  // ── Remote data ──────────────────────────────────────────────────────────
  const [me, setMe] = useState<Me | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // ── Form state ───────────────────────────────────────────────────────────
  const [amountStr, setAmountStr] = useState('')        // major-unit string, e.g. "24.50"
  const [currency, setCurrency] = useState('INR')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CategoryId>('Food')
  const [paidBy, setPaidBy] = useState('')              // user_id
  const [showPaidByMenu, setShowPaidByMenu] = useState(false)
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  // custom mode: user_id → major-unit string amount
  const [customShares, setCustomShares] = useState<Record<string, string>>({})
  // custom mode: which members are included in the split
  const [includedInCustom, setIncludedInCustom] = useState<Set<string>>(new Set())

  // ── Submit state ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }

    async function load() {
      try {
        const [meData, groupData, membersData] = await Promise.all([
          getMe(),
          getGroup(groupId),
          getGroupMembers(groupId),
        ])
        setMe(meData)
        setGroup(groupData)
        setMembers(membersData)
        setCurrency(groupData.default_currency)
        setPaidBy(meData.id)
        // All members included in custom split by default
        setIncludedInCustom(new Set(membersData.map(m => m.user_id)))
        // Seed custom shares as empty
        setCustomShares(Object.fromEntries(membersData.map(m => [m.user_id, ''])))
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHORIZED') {
          router.replace('/login')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, groupId])

  // ── Derived ──────────────────────────────────────────────────────────────

  const amountMinor = useMemo(() => {
    const v = parseFloat(amountStr)
    return isNaN(v) || v <= 0 ? 0 : Math.round(v * 100)
  }, [amountStr])

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency

  // Equal mode: per-member share (first person absorbs remainder)
  const equalSharePerMember = useMemo(() => {
    if (!amountMinor || members.length === 0) return 0
    return Math.floor(amountMinor / members.length)
  }, [amountMinor, members.length])

  const equalRemainder = amountMinor - equalSharePerMember * members.length

  // Custom mode: sum of included members' shares in minor units
  const customTotal = useMemo(() => {
    let sum = 0
    for (const [uid, val] of Object.entries(customShares)) {
      if (!includedInCustom.has(uid)) continue
      const n = parseFloat(val)
      if (!isNaN(n) && n > 0) sum += Math.round(n * 100)
    }
    return sum
  }, [customShares, includedInCustom])

  const customRemainder = amountMinor - customTotal

  // Validation
  const isFormValid = useMemo(() => {
    if (amountMinor <= 0) return false
    if (!description.trim()) return false
    if (splitMode === 'custom') {
      if (includedInCustom.size === 0) return false
      if (customRemainder !== 0) return false
    }
    return true
  }, [amountMinor, description, splitMode, includedInCustom, customRemainder])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSplitModeSwitch(mode: 'equal' | 'custom') {
    setSplitMode(mode)
    // When switching to custom, pre-fill equal shares as starting point
    if (mode === 'custom' && amountMinor > 0 && members.length > 0) {
      const base = Math.floor(amountMinor / members.length)
      const rem = amountMinor % members.length
      const seeded: Record<string, string> = {}
      members.forEach((m, i) => {
        const share = i === 0 ? base + rem : base
        seeded[m.user_id] = (share / 100).toFixed(2)
      })
      setCustomShares(seeded)
    }
  }

  function toggleMemberInCustom(uid: string, checked: boolean) {
    setIncludedInCustom(prev => {
      const next = new Set(prev)
      if (checked) next.add(uid)
      else {
        next.delete(uid)
        setCustomShares(s => ({ ...s, [uid]: '' }))
      }
      return next
    })
  }

  async function handleSubmit() {
    if (!isFormValid || submitting) return
    setSubmitting(true)
    setFormError(null)
    try {
      let split: Array<{ user_id: string; share: number }> | null = null

      if (splitMode === 'custom') {
        split = []
        for (const [uid, val] of Object.entries(customShares)) {
          if (!includedInCustom.has(uid)) continue
          split.push({ user_id: uid, share: Math.round(parseFloat(val) * 100) })
        }
      }
      // equal mode: split = null → backend computes equal split across all members

      await addExpense(groupId, {
        description: description.trim(),
        amount: amountMinor,
        currency,
        paid_by: paidBy || me!.id,
        occurred_at: new Date().toISOString(),
        split,
      })
      router.push(backHref)
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message.replace('API error ', 'Server error ')
          : 'Failed to save expense',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-secondary text-4xl">
          progress_activity
        </span>
      </div>
    )
  }

  const paidByMember = members.find(m => m.user_id === paidBy)
  const paidByLabel =
    paidBy === me?.id
      ? 'You'
      : paidByMember?.display_name ?? 'Select payer'

  const customIncludedMembers = members.filter(m => includedInCustom.has(m.user_id))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active="groups" />

      {/* ── Main canvas (blurred context behind modal) ───────────────────── */}
      <main className="flex-grow flex flex-col relative overflow-y-auto">
        {/* Top App Bar */}
        <header className="flex justify-between items-center px-container-padding h-16 w-full bg-surface border-b border-outline-variant shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <span className="text-headline-md font-headline-md font-bold text-primary">Ledgr</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border border-outline-variant">
              {me?.avatar_url ? (
                <img src={me.avatar_url} alt={me.display_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-label-md font-bold text-on-surface-variant">
                  {me?.display_name?.charAt(0).toUpperCase() ?? '?'}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Dimmed background placeholder */}
        <div className="p-container-padding grid grid-cols-12 gap-gutter opacity-40 select-none pointer-events-none">
          <div className="col-span-12 md:col-span-8 space-y-gutter">
            <div className="h-32 bg-surface-container rounded-xl shadow-sm border border-outline-variant" />
            <div className="h-64 bg-surface-container rounded-xl shadow-sm border border-outline-variant" />
            <div className="h-64 bg-surface-container rounded-xl shadow-sm border border-outline-variant" />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-gutter">
            <div className="h-96 bg-surface-container rounded-xl shadow-sm border border-outline-variant" />
          </div>
        </div>

        {/* ── Modal overlay ─────────────────────────────────────────────── */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-background/30 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant flex flex-col md:flex-row overflow-hidden max-h-[90vh] md:max-h-[640px]">

            {/* ── Left panel: basic details ──────────────────────────── */}
            <div className="flex-1 p-card-padding border-r border-outline-variant overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-headline-md font-headline-md text-primary">Add Expense</h2>
                  {group && (
                    <p className="text-label-md text-on-surface-variant mt-0.5">
                      {group.icon && <span className="mr-1">{group.icon}</span>}
                      {group.name}
                    </p>
                  )}
                </div>
                <Link
                  href={backHref}
                  className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </Link>
              </div>

              <div className="space-y-6">
                {/* Amount + Currency */}
                <div className="space-y-2">
                  <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
                    Amount &amp; Currency
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-headline-md font-headline-md text-outline select-none">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amountStr}
                        onChange={e => setAmountStr(e.target.value)}
                        className="w-full pl-10 pr-4 py-4 bg-surface rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/10 text-amount-display font-amount-display transition-all outline-none"
                      />
                    </div>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="bg-surface-container px-4 py-4 rounded-lg border border-outline-variant font-bold text-on-surface focus:border-primary outline-none h-[64px] min-w-[80px]"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
                    What was this for?
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">
                      edit_note
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Dinner with team"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-surface rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/10 text-body-lg font-body-lg transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
                    Category
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        title={cat.label}
                        onClick={() => setCategory(cat.id)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                          category === cat.id
                            ? 'bg-secondary-container text-on-secondary-container border-secondary'
                            : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{cat.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paid By */}
                <div className="space-y-2 pt-2 relative">
                  <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
                    Paid By
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPaidByMenu(v => !v)}
                    className="w-full flex items-center gap-3 p-3 bg-surface rounded-lg border border-outline-variant hover:border-primary cursor-pointer transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-fixed-dim flex items-center justify-center text-on-primary-fixed text-label-md font-bold flex-shrink-0">
                      {paidByLabel === 'You' ? 'ME' : paidByLabel.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-grow font-body-md text-on-surface">{paidByLabel}</span>
                    <span className="material-symbols-outlined text-outline">
                      {showPaidByMenu ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {showPaidByMenu && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-lg z-10 overflow-hidden">
                      {members.map(m => (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => { setPaidBy(m.user_id); setShowPaidByMenu(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors text-left ${
                            paidBy === m.user_id ? 'bg-surface-container-low' : ''
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-secondary-container flex items-center justify-center text-[11px] font-bold text-on-secondary-container flex-shrink-0">
                            {m.display_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-body-md">
                            {m.user_id === me?.id ? 'You' : m.display_name}
                          </span>
                          {paidBy === m.user_id && (
                            <span className="material-symbols-outlined text-secondary text-[16px] ml-auto">
                              check
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right panel: split logic ──────────────────────────────── */}
            <div className="w-full md:w-[400px] bg-surface-container-low p-card-padding flex flex-col overflow-y-auto custom-scrollbar">
              <div className="mb-6">
                <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider block mb-4">
                  Split With
                </label>

                {/* Split mode toggle */}
                <div className="flex bg-surface-container-high p-1 rounded-lg mb-6">
                  <button
                    onClick={() => handleSplitModeSwitch('equal')}
                    className={`flex-1 py-2 text-label-md font-label-md rounded-md transition-all ${
                      splitMode === 'equal'
                        ? 'bg-surface-container-lowest shadow-sm text-primary'
                        : 'text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    Split Equally
                  </button>
                  <button
                    onClick={() => handleSplitModeSwitch('custom')}
                    className={`flex-1 py-2 text-label-md font-label-md rounded-md transition-all ${
                      splitMode === 'custom'
                        ? 'bg-surface-container-lowest shadow-sm text-primary'
                        : 'text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    Custom Shares
                  </button>
                </div>

                {/* Member list */}
                <div className="space-y-3">
                  {members.map((m, idx) => {
                    const isMe = m.user_id === me?.id
                    const displayName = isMe ? 'You' : m.display_name
                    const isIncluded = splitMode === 'equal' || includedInCustom.has(m.user_id)

                    return (
                      <div
                        key={m.user_id}
                        className={`flex items-center gap-4 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant hover:shadow-sm transition-all ${
                          !isIncluded ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Checkbox — only interactive in custom mode */}
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          disabled={splitMode === 'equal'}
                          onChange={e => toggleMemberInCustom(m.user_id, e.target.checked)}
                          className="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary cursor-pointer disabled:cursor-default"
                        />

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm flex-shrink-0">
                          {displayName.charAt(0).toUpperCase()}
                        </div>

                        {/* Name + share */}
                        <div className="flex-grow min-w-0">
                          <p className="font-body-md font-semibold text-on-surface truncate">{displayName}</p>
                          {splitMode === 'equal' ? (
                            <p className="text-label-md text-secondary">
                              {amountMinor > 0
                                ? fmtMajor(idx === 0 ? equalSharePerMember + equalRemainder : equalSharePerMember, symbol)
                                : `${symbol} 0.00`}
                            </p>
                          ) : isIncluded ? (
                            <p className="text-label-md text-secondary">
                              {customShares[m.user_id]
                                ? fmtMajor(Math.round(parseFloat(customShares[m.user_id]) * 100), symbol)
                                : `${symbol} 0.00`}
                            </p>
                          ) : (
                            <p className="text-label-md text-on-surface-variant">Excluded</p>
                          )}
                        </div>

                        {/* Custom amount input */}
                        {splitMode === 'custom' && isIncluded && (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={customShares[m.user_id] ?? ''}
                            onChange={e =>
                              setCustomShares(prev => ({ ...prev, [m.user_id]: e.target.value }))
                            }
                            className="w-24 px-2 py-1 bg-surface border border-outline-variant rounded text-right font-body-md outline-none focus:border-primary"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer: totals + submit */}
              <div className="mt-auto pt-6 space-y-4">
                {/* Remainder indicator (custom mode) */}
                {splitMode === 'custom' && amountMinor > 0 && (
                  <div className={`flex justify-between items-center text-label-md px-1 ${
                    customRemainder === 0
                      ? 'text-secondary'
                      : customRemainder > 0
                      ? 'text-on-tertiary-container'
                      : 'text-error'
                  }`}>
                    <span>
                      {customRemainder === 0
                        ? '✓ Fully allocated'
                        : customRemainder > 0
                        ? `Unallocated`
                        : 'Over-allocated'}
                    </span>
                    <span className="font-bold">
                      {customRemainder !== 0 && fmtMajor(Math.abs(customRemainder), symbol)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-on-surface-variant">
                  <span className="text-label-md">Total</span>
                  <span className="text-headline-md font-bold text-primary">
                    {amountMinor > 0 ? fmtMajor(amountMinor, symbol) : `${symbol} 0.00`}
                  </span>
                </div>

                {formError && (
                  <p className="text-error text-label-md text-center">{formError}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!isFormValid || submitting}
                  className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-lg"
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[20px]">
                        progress_activity
                      </span>
                      Saving…
                    </>
                  ) : (
                    <>
                      Save Expense
                      <span className="material-symbols-outlined">check_circle</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  )
}
