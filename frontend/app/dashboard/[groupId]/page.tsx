'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { useGroupSocket } from '@/hooks/useGroupSocket'
import { fmtAmount, amountColorClass } from '@/lib/fmt'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardDivider } from '@/components/ui/card'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/top-nav'

interface Balances { [userId: string]: { [currency: string]: number } }
interface EventItem {
  id: string; event_type: string; payload: Record<string, unknown>; created_at: string
}
interface Member { user_id: string; display_name: string; email: string; role: string }
interface Transaction { from_user: string; to_user: string; amount: number; currency: string }
interface PendingPayment {
  payment_id: string; from: string; to: string; amount: string; currency: string; created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  expense_added: 'Expense added',
  expense_edited: 'Expense edited',
  expense_deleted: 'Expense deleted',
  payment_made: 'Payment recorded',
  payment_initiated: 'Payment initiated',
  payment_confirmed: 'Payment confirmed',
}

function EventIcon({ type }: { type: string }) {
  const isPayment = type.startsWith('payment')
  const isDelete = type === 'expense_deleted'
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
      isPayment ? 'bg-owed-bg text-owed-dim' :
      isDelete  ? 'bg-owing-bg text-owing-dim' :
                  'bg-primary/10 text-primary'
    }`}>
      {isPayment ? '↔' : isDelete ? '×' : '+'}
    </div>
  )
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
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [payDialog, setPayDialog] = useState<{
    toUser: string; toName: string; maxMinor: number; currency: string; input: string
  } | null>(null)

  const refresh = useCallback(() => {
    apiFetch('/auth/me').then(r => r.json()).then(u => setCurrentUserId(u.id))
    apiFetch(`/groups/${groupId}`).then(r => r.json()).then(g => {
      setGroupName(g.name)
      setGroupStatus(g.status)
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
  const myBalances = balances[currentUserId] ?? {}
  const allSettled = Object.values(balances).every(ccys =>
    Object.values(ccys).every(a => a === 0)
  )

  async function generateInvite() {
    const res = await apiFetch('/invites', { method: 'POST', body: JSON.stringify({ group_id: groupId }) })
    if (!res.ok) return
    const data = await res.json()
    setInviteLink(`${window.location.origin}/invite/${data.token}`)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openPayDialog(tx: Transaction) {
    setPayDialog({
      toUser: tx.to_user,
      toName: memberMap[tx.to_user] ?? tx.to_user.slice(0, 8),
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

  const isActive = groupStatus === 'active'
  const myPendingIncoming = pendingPayments.filter(p => p.to === currentUserId)

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader
        title={groupName || '…'}
        onBack={() => router.push('/dashboard')}
        badge={
          groupStatus === 'archived' ? <Badge variant="archived">Archived</Badge> : null
        }
        action={
          <div className="flex items-center gap-2">
            <Badge variant={connected ? 'live' : 'offline'} dot>
              {connected ? 'Live' : 'Offline'}
            </Badge>
            {isActive && (
              <Button size="sm" onClick={() => router.push(`/dashboard/${groupId}/new-expense`)}>
                + Add expense
              </Button>
            )}
          </div>
        }
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-container py-8 space-y-5">

        {/* My balance hero */}
        {currentUserId && Object.keys(myBalances).length > 0 && (
          <Card>
            <CardBody>
              <p className="section-label mb-3">Your balance</p>
              <div className="flex flex-wrap gap-6">
                {Object.entries(myBalances).map(([ccy, amt]) => (
                  <div key={ccy}>
                    <p className={`text-amount-display font-semibold ${amountColorClass(amt)}`}>
                      {amt > 0 ? '+' : ''}{fmtAmount(amt, ccy)}
                    </p>
                    <p className="text-xs text-on-surface-muted mt-1">
                      {amt > 0 ? 'You are owed' : amt < 0 ? 'You owe' : 'All settled'}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* All member balances */}
        {Object.keys(balances).length > 0 && (
          <Card>
            <CardHeader
              title="Group balances"
              subtitle={`${members.length} member${members.length !== 1 ? 's' : ''}`}
            />
            <CardDivider />
            <ul>
              {Object.entries(balances).flatMap(([uid, ccys]) =>
                Object.entries(ccys).map(([ccy, amt]) => (
                  <li key={uid + ccy} className="flex items-center justify-between px-card py-3 border-b border-outline-variant last:border-0">
                    <div className="flex items-center gap-3">
                      <Avatar name={memberMap[uid] ?? '?'} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-on-surface">
                          {memberMap[uid] ?? uid.slice(0, 8) + '…'}
                          {uid === currentUserId && (
                            <span className="ml-1.5 text-xs text-on-surface-muted font-normal">(you)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${amountColorClass(amt)}`}>
                      {amt > 0 ? '+' : ''}{fmtAmount(amt, ccy)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        )}

        {/* Settlement suggestions */}
        {settlement.length > 0 && (
          <Card>
            <CardHeader title="Settle up" subtitle="Suggested transfers to clear all balances" />
            <CardDivider />
            <ul>
              {settlement.map((tx, i) => {
                const isMe = tx.from_user === currentUserId
                const isPending = pendingPayments.some(
                  p => p.from === tx.from_user && p.to === tx.to_user
                )
                const isDialogOpen = payDialog?.toUser === tx.to_user && isMe
                return (
                  <li key={i} className="border-b border-outline-variant last:border-0">
                    <div className="flex items-center justify-between px-card py-3.5">
                      <div className="flex items-center gap-2 min-w-0 text-sm">
                        <Avatar name={memberMap[tx.from_user] ?? '?'} size="xs" />
                        <span className={isMe ? 'font-semibold text-owing' : 'text-on-surface'}>
                          {isMe ? 'You' : memberMap[tx.from_user] ?? tx.from_user.slice(0, 8)}
                        </span>
                        <span className="text-on-surface-muted">→</span>
                        <Avatar name={memberMap[tx.to_user] ?? '?'} size="xs" />
                        <span className="text-on-surface">
                          {memberMap[tx.to_user] ?? tx.to_user.slice(0, 8)}
                        </span>
                        <span className="font-semibold text-on-surface tabular-nums ml-1">
                          {fmtAmount(tx.amount, tx.currency)}
                        </span>
                      </div>

                      {isMe && isActive && (
                        isPending ? (
                          <Badge variant="warning">Awaiting</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => isDialogOpen ? setPayDialog(null) : openPayDialog(tx)}
                          >
                            {isDialogOpen ? 'Cancel' : 'Mark paid'}
                          </Button>
                        )
                      )}
                    </div>

                    {/* Inline payment input */}
                    {isDialogOpen && payDialog && (
                      <div className="px-card pb-4 pt-1 bg-surface-low border-t border-outline-variant">
                        <p className="text-xs text-on-surface-muted mb-2">
                          Amount to pay to {payDialog.toName}
                          <span className="text-on-surface font-medium ml-1">
                            (max {fmtAmount(payDialog.maxMinor, payDialog.currency)})
                          </span>
                        </p>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={payDialog.input}
                            onChange={e => setPayDialog({ ...payDialog, input: e.target.value })}
                            step="0.01"
                            min="0.01"
                            className="input-base flex-1"
                            autoFocus
                          />
                          <span className="text-sm text-on-surface-muted shrink-0">{payDialog.currency}</span>
                          <Button size="sm" onClick={confirmPayment}>Confirm</Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {/* Pending incoming payments — receiver confirms */}
        {myPendingIncoming.length > 0 && (
          <Card>
            <CardHeader title="Awaiting your confirmation" />
            <CardDivider />
            <ul>
              {myPendingIncoming.map(p => (
                <li key={p.payment_id} className="flex items-center justify-between px-card py-3.5 border-b border-outline-variant last:border-0">
                  <div className="flex items-center gap-3 text-sm">
                    <Avatar name={memberMap[p.from] ?? '?'} size="sm" />
                    <div>
                      <p className="text-on-surface font-medium">
                        {memberMap[p.from] ?? p.from.slice(0, 8)}
                      </p>
                      <p className="text-on-surface-muted text-xs mt-0.5">
                        sent you{' '}
                        <span className="font-semibold text-owed">
                          {fmtAmount(Number(p.amount), p.currency)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="teal" onClick={() => markReceived(p.payment_id)}>
                    Mark received
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Members & invite */}
        <Card>
          <CardHeader
            title="Members"
            subtitle={`${members.length} member${members.length !== 1 ? 's' : ''}`}
            action={
              isOwner && isActive ? (
                <button
                  onClick={generateInvite}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  + Invite
                </button>
              ) : undefined
            }
          />
          {members.length > 0 && (
            <>
              <CardDivider />
              <ul>
                {members.map(m => (
                  <li key={m.user_id} className="flex items-center justify-between px-card py-3 border-b border-outline-variant last:border-0">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.display_name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-on-surface">
                          {m.display_name}
                          {m.user_id === currentUserId && (
                            <span className="ml-1.5 text-xs text-on-surface-muted font-normal">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-on-surface-muted mt-0.5">{m.email}</p>
                      </div>
                    </div>
                    <Badge variant={m.role === 'owner' ? 'owner' : 'default'}>
                      {m.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}

          {inviteLink && (
            <>
              <CardDivider />
              <div className="px-card py-3 flex items-center gap-3">
                <p className="flex-1 font-mono text-xs text-on-surface-muted truncate">{inviteLink}</p>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? '✓ Copied' : 'Copy link'}
                </Button>
              </div>
            </>
          )}
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader title="Activity" />
          {events.length > 0 ? (
            <>
              <CardDivider />
              <ul>
                {events.map(ev => {
                  const isPaymentEv = ev.event_type.startsWith('payment')
                  const p = ev.payload
                  const hasAmount = p.amount && p.currency
                  const from = memberMap[p.from as string]
                  const to = memberMap[p.to as string]
                  return (
                    <li key={ev.id} className="flex gap-3 px-card py-3.5 border-b border-outline-variant last:border-0">
                      <EventIcon type={ev.event_type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-on-surface">
                              {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                            </p>
                            {p.description && (
                              <p className="text-xs text-on-surface-muted mt-0.5 truncate">
                                {p.description as string}
                              </p>
                            )}
                            {isPaymentEv && from && to && (
                              <p className="text-xs text-on-surface-muted mt-0.5">
                                {from} → {to}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {hasAmount && (
                              <p className="text-sm font-semibold text-on-surface tabular-nums">
                                {fmtAmount(Number(p.amount), p.currency as string)}
                              </p>
                            )}
                            <p className="text-xs text-on-surface-muted mt-0.5">
                              {new Date(ev.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        {ev.event_type === 'expense_added' && (
                          <a
                            href={`/dashboard/${groupId}/edit-expense/${p.expense_id}`}
                            className="text-xs text-primary hover:underline mt-1 inline-block"
                          >
                            Edit / delete
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <CardBody className="py-8 text-center">
              <p className="text-sm text-on-surface-muted">No activity yet.</p>
              {isActive && (
                <p className="text-xs text-on-surface-muted mt-1">
                  Add the first expense to get started.
                </p>
              )}
            </CardBody>
          )}
        </Card>

        {/* Archive */}
        {isOwner && allSettled && isActive && (
          <Card>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-on-surface">All settled up</p>
                <p className="text-xs text-on-surface-muted mt-0.5">
                  Archive this group to mark it complete.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={archiving}
                onClick={archiveGroup}
              >
                Archive group
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
