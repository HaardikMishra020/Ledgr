'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/auth'
import {
  getMe, getGroupBalances, getGroupSettlement, getGroupMembers, getPendingPayments,
  initiatePayment, confirmPaymentTwoStep,
} from '@/lib/api'
import type { Me, SettlementTransaction, Member, PendingPayment } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

type Step = 'selection' | 'payment' | 'initiated'

type SettleItem = {
  groupId: string
  groupName: string
  groupIcon: string | null
  counterpartName: string
  toUserId: string
  amount: number
  currency: string
  direction: 'owe' | 'owed'
}

type PendingReceiptItem = {
  groupId: string
  groupName: string
  groupIcon: string | null
  fromUserId: string
  fromName: string
  paymentId: string
  amount: number
  currency: string
}

// key = `${groupId}::${toUserId}` — used to mark owe items I've already notified
type PendingOutgoingSet = Set<string>

function fmtAmount(minorUnits: number, currency: string): string {
  const major = Math.abs(minorUnits) / 100
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${major.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SettlementsPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [items, setItems] = useState<SettleItem[]>([])
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceiptItem[]>([])
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoingSet>(new Set())
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('selection')
  const [selected, setSelected] = useState<SettleItem | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Track per-paymentId confirm state without re-fetching the whole page
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set())
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [meData, groups] = await Promise.all([getMe(), getGroupBalances()])
      setMe(meData)

      const settleItems: SettleItem[] = []
      const receipts: PendingReceiptItem[] = []
      const outgoingKeys: PendingOutgoingSet = new Set()

      await Promise.all(
        groups.map(async (g) => {
          const [settlement, members, pending] = await Promise.all([
            getGroupSettlement(g.group_id).catch(() => ({ transactions: [] as SettlementTransaction[] })),
            getGroupMembers(g.group_id).catch(() => [] as Member[]),
            getPendingPayments(g.group_id).catch(() => [] as PendingPayment[]),
          ])
          const memberMap = new Map(members.map(m => [m.user_id, m]))

          for (const tx of settlement.transactions) {
            if (tx.from_user === meData.id) {
              settleItems.push({
                groupId: g.group_id, groupName: g.group_name, groupIcon: g.icon,
                counterpartName: memberMap.get(tx.to_user)?.display_name ?? 'Group Member',
                toUserId: tx.to_user, amount: tx.amount, currency: tx.currency,
                direction: 'owe',
              })
            } else if (tx.to_user === meData.id) {
              settleItems.push({
                groupId: g.group_id, groupName: g.group_name, groupIcon: g.icon,
                counterpartName: memberMap.get(tx.from_user)?.display_name ?? 'Group Member',
                toUserId: tx.from_user, amount: tx.amount, currency: tx.currency,
                direction: 'owed',
              })
            }
          }

          for (const p of pending) {
            if (p.to === meData.id) {
              receipts.push({
                groupId: g.group_id, groupName: g.group_name, groupIcon: g.icon,
                fromUserId: p.from,
                fromName: memberMap.get(p.from)?.display_name ?? 'Group Member',
                paymentId: p.payment_id,
                amount: Number(p.amount),
                currency: p.currency,
              })
            }
            if (p.from === meData.id) {
              outgoingKeys.add(`${g.group_id}::${p.to}`)
            }
          }
        })
      )

      setItems(settleItems)
      setPendingReceipts(receipts)
      setPendingOutgoing(outgoingKeys)
      setConfirmedIds(new Set())
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') {
        router.replace('/login')
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }
    load()
  }, [load, router])

  async function handleInitiatePayment() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      await initiatePayment(selected.groupId, {
        to_user_id: selected.toUserId,
        amount: selected.amount,
        currency: selected.currency,
      }, idempotencyKey)
      setStep('initiated')
    } catch {
      setError('Failed to send payment notification. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmReceipt(receipt: PendingReceiptItem) {
    setConfirmingIds(prev => new Set(prev).add(receipt.paymentId))
    setError(null)
    try {
      await confirmPaymentTwoStep(receipt.groupId, receipt.paymentId)
      // Dismiss all receipts that are exact duplicates of the one just confirmed
      // (same sender, same group, same amount, same currency = button-mash dupes).
      // Receipts with a different amount are intentional partial payments — leave them.
      const siblingIds = pendingReceipts
        .filter(r =>
          r.groupId === receipt.groupId &&
          r.fromUserId === receipt.fromUserId &&
          r.amount === receipt.amount &&
          r.currency === receipt.currency
        )
        .map(r => r.paymentId)
      setConfirmedIds(prev => new Set([...prev, ...siblingIds]))
    } catch {
      setError('Failed to confirm receipt. Please try again.')
    } finally {
      setConfirmingIds(prev => { const s = new Set(prev); s.delete(receipt.paymentId); return s })
    }
  }

  function selectItem(item: SettleItem) {
    setSelected(item)
    setIdempotencyKey(crypto.randomUUID())
    setStep('payment')
    setError(null)
  }

  function reset() {
    setStep('selection')
    setSelected(null)
    setError(null)
    load()
  }

  const oweItems = items.filter(i => i.direction === 'owe')
  const owedItems = items.filter(i => i.direction === 'owed')
  const visibleReceipts = useMemo(() => {
    // Collapse exact duplicates (same sender + same amount + same currency) down to one
    // receipt — these are button-mash dupes of the same intended payment.
    // Different amounts from the same sender are kept separate: they are distinct
    // partial payments and must each be confirmed independently.
    const seen = new Map<string, PendingReceiptItem>()
    for (const r of pendingReceipts) {
      if (!confirmedIds.has(r.paymentId)) {
        seen.set(`${r.groupId}::${r.fromUserId}::${r.amount}::${r.currency}`, r)
      }
    }
    return Array.from(seen.values())
  }, [pendingReceipts, confirmedIds])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-secondary text-4xl">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="settlements" />

      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="flex justify-between items-center px-container-padding h-16 w-full bg-surface border-b border-outline-variant shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {step !== 'selection' && (
              <button
                onClick={reset}
                className="p-2 hover:bg-surface-container-high rounded-full transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
              </button>
            )}
            <h2 className="text-headline-md font-headline-md font-bold text-primary">Settle Up</h2>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container flex items-center justify-center">
            {me?.avatar_url ? (
              <img alt={me.display_name} src={me.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-label-md font-bold text-on-surface-variant">
                {me?.display_name?.charAt(0).toUpperCase() ?? '?'}
              </span>
            )}
          </div>
        </header>

        <div className="p-container-padding flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-8">

            {/* STEP 1 — Selection */}
            {step === 'selection' && (
              <section className="fade-in space-y-10">

                {/* Pending receipts: payments others sent to me, awaiting my confirmation */}
                {visibleReceipts.length > 0 && (
                  <div>
                    <h3 className="text-headline-md font-headline-md mb-1">Confirm Receipts</h3>
                    <p className="text-body-md text-on-surface-variant mb-4">
                      These members have notified you of a payment — confirm once you've received the money.
                    </p>
                    {error && <p className="text-error text-body-md mb-3">{error}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                      {visibleReceipts.map(receipt => (
                        <div
                          key={receipt.paymentId}
                          className="bg-surface-container-lowest border border-secondary p-card-padding rounded-xl shadow-sm"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center shrink-0 text-xl">
                              {receipt.groupIcon ?? (
                                <span className="material-symbols-outlined text-on-secondary-container">group</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-headline-md font-headline-md truncate">{receipt.fromName}</h4>
                              <p className="text-body-md text-secondary">
                                sent you {fmtAmount(receipt.amount, receipt.currency)}
                              </p>
                              <p className="text-label-md text-on-surface-variant truncate">{receipt.groupName}</p>
                            </div>
                            <button
                              onClick={() => handleConfirmReceipt(receipt)}
                              disabled={confirmingIds.has(receipt.paymentId)}
                              className="shrink-0 px-4 py-2 bg-secondary text-on-secondary rounded-lg font-label-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {confirmingIds.has(receipt.paymentId) ? '…' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Owe / Owed balances */}
                <div>
                  <h3 className="text-headline-md font-headline-md mb-1">Balances</h3>
                  <p className="text-body-md text-on-surface-variant mb-4">
                    Click a balance you owe to notify the other person of your payment.
                  </p>

                  {items.length === 0 && visibleReceipts.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center mx-auto mb-6">
                        <span
                          className="material-symbols-outlined text-4xl"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      </div>
                      <h4 className="text-headline-md font-headline-md mb-2">All settled up!</h4>
                      <p className="text-body-lg text-on-surface-variant">You have no outstanding balances.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                      {oweItems.map((item, idx) => {
                        const isPending = pendingOutgoing.has(`${item.groupId}::${item.toUserId}`)
                        if (isPending) {
                          return (
                            <div
                              key={`owe-${item.groupId}-${item.toUserId}-${idx}`}
                              className="bg-surface-container-lowest border border-secondary/40 p-card-padding rounded-xl shadow-sm opacity-80"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center shrink-0 text-xl">
                                  {item.groupIcon ?? (
                                    <span className="material-symbols-outlined text-on-secondary-container">group</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-headline-md font-headline-md truncate">{item.counterpartName}</h4>
                                  <p className="text-body-md text-secondary">
                                    You owe {fmtAmount(item.amount, item.currency)}
                                  </p>
                                  <p className="text-label-md text-on-surface-variant truncate">{item.groupName}</p>
                                </div>
                                <span className="flex items-center gap-1 text-label-md font-label-md text-secondary shrink-0">
                                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                                  Awaiting
                                </span>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <button
                            key={`owe-${item.groupId}-${item.toUserId}-${idx}`}
                            className="group text-left cursor-pointer bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl shadow-sm hover:border-primary hover:shadow-md transition-all"
                            onClick={() => selectItem(item)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-xl">
                                {item.groupIcon ?? (
                                  <span className="material-symbols-outlined text-on-surface-variant">group</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-headline-md font-headline-md truncate">{item.counterpartName}</h4>
                                <p className="text-body-md text-secondary">
                                  You owe {fmtAmount(item.amount, item.currency)}
                                </p>
                                <p className="text-label-md text-on-surface-variant truncate">{item.groupName}</p>
                              </div>
                              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors shrink-0">
                                chevron_right
                              </span>
                            </div>
                          </button>
                        )
                      })}

                      {owedItems.map((item, idx) => (
                        <div
                          key={`owed-${item.groupId}-${item.toUserId}-${idx}`}
                          className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl shadow-sm opacity-80"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-xl">
                              {item.groupIcon ?? (
                                <span className="material-symbols-outlined text-on-surface-variant">group</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-headline-md font-headline-md truncate">{item.counterpartName}</h4>
                              <p className="text-body-md text-on-tertiary-container">
                                {item.counterpartName} owes you {fmtAmount(item.amount, item.currency)}
                              </p>
                              <p className="text-label-md text-on-surface-variant truncate">{item.groupName}</p>
                            </div>
                            <span className="material-symbols-outlined text-outline shrink-0">chevron_right</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* STEP 2 — Payment initiation */}
            {step === 'payment' && selected && (
              <section className="fade-in max-w-lg mx-auto">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary-container text-on-secondary-container mb-6">
                    <span className="material-symbols-outlined text-4xl">send</span>
                  </div>
                  <h3 className="text-headline-lg font-headline-lg mb-2">
                    Notify {selected.counterpartName}
                  </h3>
                  <div className="text-amount-display font-amount-display text-primary mt-4 mb-2">
                    {fmtAmount(selected.amount, selected.currency)}
                  </div>
                  <p className="text-body-md text-on-surface-variant">
                    Settlement for {selected.groupName}
                  </p>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl shadow-sm mb-8">
                  <p className="text-body-md text-on-surface-variant">
                    This records that you have paid <strong>{selected.counterpartName}</strong>.
                    Your balance will update once they confirm receipt on their Settlements page.
                  </p>
                </div>

                {error && (
                  <p className="text-error text-body-md text-center mb-4">{error}</p>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleInitiatePayment}
                    disabled={submitting}
                    className="w-full py-4 bg-primary text-on-primary rounded-lg font-headline-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending…' : 'Send Payment Notification'}
                  </button>
                  <button
                    onClick={reset}
                    className="w-full py-4 text-primary font-headline-md hover:bg-surface-container-high rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            {/* STEP 3 — Initiated (waiting for receiver to confirm) */}
            {step === 'initiated' && selected && (
              <section className="fade-in max-w-2xl mx-auto space-y-6">
                <div className="bg-secondary-container p-6 rounded-xl border-l-8 border-secondary shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl text-secondary">schedule</span>
                    </div>
                    <div>
                      <h4 className="text-headline-md text-on-secondary-container mb-1">
                        Payment notification sent to {selected.counterpartName}
                      </h4>
                      <p className="text-body-md text-on-surface-variant">
                        {fmtAmount(selected.amount, selected.currency)} · {selected.groupName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl">
                  <h5 className="text-label-md text-on-surface-variant uppercase mb-4">
                    Verification Progress
                  </h5>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-secondary w-1/2" />
                    </div>
                    <span className="text-label-md text-secondary">Step 1 of 2 Complete</span>
                  </div>
                  <p className="mt-4 text-body-md text-on-surface-variant italic">
                    Waiting for {selected.counterpartName} to confirm receipt. Your balance updates once
                    they confirm on their Settlements page.
                  </p>
                </div>

                <button
                  onClick={reset}
                  className="w-full py-4 bg-primary text-on-primary rounded-lg font-headline-md hover:opacity-90 transition-opacity active:scale-95"
                >
                  Back to Settlements
                </button>
              </section>
            )}

          </div>
        </div>
      </main>
      <BottomNav active="settlements" />
    </div>
  )
}
