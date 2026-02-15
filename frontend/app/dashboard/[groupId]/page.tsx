'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { useGroupSocket } from '@/hooks/useGroupSocket'

interface Balances { [userId: string]: { [currency: string]: number } }
interface EventItem {
  id: string; event_type: string; payload: Record<string, unknown>; created_at: string
}
interface Member { user_id: string; display_name: string; email: string; role: string; joined_at: string }
interface Transaction { from_user: string; to_user: string; amount: number; currency: string }
interface PendingPayment {
  payment_id: string; from: string; to: string; amount: string; currency: string; created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  expense_added: 'Expense added', expense_edited: 'Expense edited',
  expense_deleted: 'Expense deleted', payment_made: 'Payment recorded',
  payment_initiated: 'Payment initiated', payment_confirmed: 'Payment confirmed',
}

function fmtAmount(minor: number, ccy: string): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(minor / 100) }
  catch { return `${minor / 100} ${ccy}` }
}

function amountLabel(ev: EventItem): string {
  const p = ev.payload
  if (!p.amount || !p.currency) return ''
  return fmtAmount(Number(p.amount), p.currency as string)
}

function paymentLine(ev: EventItem, memberMap: Record<string, string>): string | null {
  if (!['payment_initiated', 'payment_confirmed', 'payment_made'].includes(ev.event_type)) return null
  const p = ev.payload
  const from = memberMap[p.from as string] ?? (p.from as string)?.slice(0, 8)
  const to   = memberMap[p.to   as string] ?? (p.to   as string)?.slice(0, 8)
  const amt  = fmtAmount(Number(p.amount), p.currency as string)
  return `${from} → ${to}: ${amt}`
}

export default function GroupDetailPage({ params }: { params: { groupId: string } }) {
  const { groupId } = params
  const router = useRouter()
  const [balances, setBalances] = useState<Balances>({})
  const [events, setEvents] = useState<EventItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [settlement, setSettlement] = useState<Transaction[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupStatus, setGroupStatus] = useState('active')
  const [groupCurrency, setGroupCurrency] = useState('USD')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [payDialog, setPayDialog] = useState<{
    toUser: string; maxMinor: number; currency: string; input: string
  } | null>(null)

  const refresh = useCallback(() => {
    apiFetch('/auth/me').then(r => r.json()).then(u => setCurrentUserId(u.id))
    apiFetch(`/groups/${groupId}`).then(r => r.json()).then(g => {
      setGroupName(g.name); setGroupStatus(g.status); setGroupCurrency(g.default_currency)
    })
    apiFetch(`/groups/${groupId}/balances`).then(r => r.json()).then(d => setBalances(d.balances ?? {}))
    apiFetch(`/groups/${groupId}/activity?limit=50`).then(r => r.json())
      .then((evs: EventItem[]) => setEvents([...evs].reverse()))
    apiFetch(`/groups/${groupId}/members`).then(r => r.json()).then(setMembers)
    apiFetch(`/groups/${groupId}/settlement`).then(r => r.json()).then(d => setSettlement(d.transactions ?? []))
    apiFetch(`/groups/${groupId}/pending-payments`).then(r => r.json()).then(setPendingPayments)
  }, [groupId])

  useEffect(() => { refresh() }, [refresh])
  const { connected } = useGroupSocket(groupId, refresh)

  const memberMap = Object.fromEntries(members.map(m => [m.user_id, m.display_name]))
  const myRole = members.find(m => m.user_id === currentUserId)?.role ?? ''
  const isOwner = myRole === 'owner'
  const allSettled = Object.values(balances).every(ccys => Object.values(ccys).every(a => a === 0))

  async function generateInvite() {
    const res = await apiFetch('/invites', { method: 'POST', body: JSON.stringify({ group_id: groupId }) })
    if (!res.ok) return
    const data = await res.json()
    setInviteLink(`${window.location.origin}/invite/${data.token}`)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function openPayDialog(tx: Transaction) {
    setPayDialog({
      toUser: tx.to_user,
      maxMinor: tx.amount,
      currency: tx.currency,
      input: (tx.amount / 100).toFixed(2),
    })
  }

  async function confirmPayment() {
    if (!payDialog) return
    const amountMinor = Math.round(parseFloat(payDialog.input) * 100)
    if (isNaN(amountMinor) || amountMinor <= 0) return
    await apiFetch(`/groups/${groupId}/payments/initiate`, {
      method: 'POST',
      body: JSON.stringify({ to_user_id: payDialog.toUser, amount: amountMinor, currency: payDialog.currency }),
    })
    setPayDialog(null)
    refresh()
  }

  async function markReceived(paymentId: string) {
    await apiFetch(`/groups/${groupId}/payments/${paymentId}/confirm`, { method: 'POST' })
    refresh()
  }

  async function archiveGroup() {
    if (!confirm('Archive this group? No new expenses can be added after archiving.')) return
    setArchiving(true)
    await apiFetch(`/groups/${groupId}/archive`, { method: 'PATCH' })
    setArchiving(false)
    refresh()
  }

  const fmt = fmtAmount

  return (
    <div className="max-w-lg mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
          <h1 className="text-2xl font-bold">{groupName || '…'}</h1>
          {groupStatus === 'archived' && (
            <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">archived</span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
          {connected ? '● live' : '○ offline'}
        </span>
      </div>

      {/* Members */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-700">Members ({members.length})</h2>
          {isOwner && groupStatus === 'active' && (
            <button onClick={generateInvite} className="text-sm text-indigo-600 hover:text-indigo-800">
              + Invite
            </button>
          )}
        </div>
        <ul className="space-y-1 mb-3">
          {members.map(m => (
            <li key={m.user_id} className="flex justify-between items-center px-3 py-2 bg-white rounded border text-sm">
              <div>
                <span className="font-medium">{m.display_name}</span>
                <span className="ml-2 text-gray-400 text-xs">{m.email}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'owner' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                {m.role}
              </span>
            </li>
          ))}
        </ul>
        {inviteLink && (
          <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded text-sm">
            <span className="flex-1 font-mono text-xs truncate text-indigo-700">{inviteLink}</span>
            <button onClick={copyLink} className="shrink-0 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </section>

      {/* Balances */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-700">Balances</h2>
          {groupStatus === 'active' && (
            <a href={`/dashboard/${groupId}/new-expense`} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded">
              + Add expense
            </a>
          )}
        </div>
        {Object.keys(balances).length === 0 ? (
          <p className="text-sm text-gray-400">No transactions yet</p>
        ) : (
          <ul className="space-y-1">
            {Object.entries(balances).flatMap(([uid, ccys]) =>
              Object.entries(ccys).map(([ccy, amt]) => (
                <li key={uid + ccy} className="flex justify-between items-center px-3 py-2 bg-white rounded border text-sm">
                  <span className="font-medium">{memberMap[uid] ?? uid.slice(0, 8) + '…'}</span>
                  <span className={amt >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {amt >= 0 ? '+' : ''}{fmt(amt, ccy)}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      {/* Settlement */}
      {settlement.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">Settlement</h2>
          <ul className="space-y-2">
            {settlement.map((tx, i) => {
              const isMe = tx.from_user === currentUserId
              const isPending = pendingPayments.some(p => p.from === tx.from_user && p.to === tx.to_user)
              const isDialogOpen = payDialog?.toUser === tx.to_user && isMe
              return (
                <li key={i} className="bg-white rounded border text-sm overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2">
                    <span>
                      <span className={isMe ? 'font-semibold text-red-600' : 'text-gray-700'}>
                        {memberMap[tx.from_user] ?? tx.from_user.slice(0, 8)}
                      </span>
                      <span className="text-gray-400 mx-1.5">→</span>
                      <span className="text-gray-700">{memberMap[tx.to_user] ?? tx.to_user.slice(0, 8)}</span>
                      <span className="ml-2 font-medium">{fmt(tx.amount, tx.currency)}</span>
                    </span>
                    {isMe && groupStatus === 'active' && (
                      isPending ? (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                          Awaiting confirmation
                        </span>
                      ) : (
                        <button
                          onClick={() => isDialogOpen ? setPayDialog(null) : openPayDialog(tx)}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded"
                        >
                          {isDialogOpen ? 'Cancel' : 'Mark paid'}
                        </button>
                      )
                    )}
                  </div>

                  {/* Inline partial payment form */}
                  {isDialogOpen && payDialog && (
                    <div className="px-3 pb-3 pt-1 border-t bg-amber-50 flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">
                          Amount to pay (max {fmt(payDialog.maxMinor, payDialog.currency)})
                        </label>
                        <input
                          type="number"
                          value={payDialog.input}
                          onChange={e => setPayDialog({ ...payDialog, input: e.target.value })}
                          step="0.01"
                          min="0.01"
                          className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          autoFocus
                        />
                      </div>
                      <span className="text-sm text-gray-500 mb-1.5">{payDialog.currency}</span>
                      <button
                        onClick={confirmPayment}
                        className="mb-0.5 bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-2 rounded font-medium"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Pending payments — receiver confirms */}
      {pendingPayments.filter(p => p.to === currentUserId).length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">Awaiting your confirmation</h2>
          <ul className="space-y-2">
            {pendingPayments.filter(p => p.to === currentUserId).map(p => (
              <li key={p.payment_id} className="flex justify-between items-center px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">
                <span>
                  <span className="font-medium">{memberMap[p.from] ?? p.from.slice(0, 8)}</span>
                  <span className="text-gray-500 mx-1">sent you</span>
                  <span className="font-semibold text-green-700">
                    {fmt(Number(p.amount), p.currency)}
                  </span>
                </span>
                <button
                  onClick={() => markReceived(p.payment_id)}
                  className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                >
                  Mark received
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Archive */}
      {isOwner && allSettled && groupStatus === 'active' && (
        <section className="border-t pt-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-700">All settled up</p>
              <p className="text-xs text-gray-400">Archive this group to mark it as complete.</p>
            </div>
            <button
              onClick={archiveGroup}
              disabled={archiving}
              className="text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 px-3 py-1.5 rounded"
            >
              {archiving ? 'Archiving…' : 'Archive group'}
            </button>
          </div>
        </section>
      )}

      {/* Activity */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Activity</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet</p>
        ) : (
          <ul className="space-y-2">
            {events.map(ev => {
              const label = amountLabel(ev)
              const pyLine = paymentLine(ev, memberMap)
              return (
                <li key={ev.id} className="px-3 py-2 bg-white rounded border text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
                    <span className="text-gray-400 text-xs">{new Date(ev.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5 flex gap-2">
                    {ev.payload.description && <span>{ev.payload.description as string}</span>}
                    {pyLine
                      ? <span className="font-medium text-gray-700">{pyLine}</span>
                      : label && <span className="font-medium text-gray-700">{label}</span>
                    }
                  </div>
                  {ev.event_type === 'expense_added' && (
                    <a href={`/dashboard/${groupId}/edit-expense/${ev.payload.expense_id}`}
                       className="text-xs text-indigo-500 hover:underline mt-1 inline-block">
                      Edit / delete
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
