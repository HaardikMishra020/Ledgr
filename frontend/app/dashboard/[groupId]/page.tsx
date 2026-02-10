'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface Balances {
  [userId: string]: { [currency: string]: number }
}

interface EventItem {
  id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
  sequence_number: number
}

const EVENT_LABELS: Record<string, string> = {
  expense_added: 'Expense added',
  expense_edited: 'Expense edited',
  expense_deleted: 'Expense deleted',
  payment_made: 'Payment recorded',
}

export default function GroupDetailPage({
  params,
}: {
  params: { groupId: string }
}) {
  const { groupId } = params
  const router = useRouter()
  const [balances, setBalances] = useState<Balances>({})
  const [events, setEvents] = useState<EventItem[]>([])
  const [groupName, setGroupName] = useState('')

  const refresh = useCallback(() => {
    apiFetch(`/groups/${groupId}`)
      .then(r => r.json())
      .then(g => setGroupName(g.name))
    apiFetch(`/groups/${groupId}/balances`)
      .then(r => r.json())
      .then(d => setBalances(d.balances ?? {}))
    apiFetch(`/groups/${groupId}/activity?limit=50`)
      .then(r => r.json())
      .then((evs: EventItem[]) => setEvents([...evs].reverse()))
  }, [groupId])

  useEffect(() => { refresh() }, [refresh])

  const fmt = (minor: number, ccy: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(minor / 100)

  return (
    <div className="max-w-lg mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back
        </button>
        <h1 className="text-2xl font-bold">{groupName || '…'}</h1>
      </div>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-700">Balances</h2>
          <a
            href={`/dashboard/${groupId}/new-expense`}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded"
          >
            + Add expense
          </a>
        </div>
        {Object.keys(balances).length === 0 ? (
          <p className="text-sm text-gray-400">No transactions yet</p>
        ) : (
          <ul className="space-y-1">
            {Object.entries(balances).flatMap(([uid, ccys]) =>
              Object.entries(ccys).map(([ccy, amt]) => (
                <li
                  key={uid + ccy}
                  className="flex justify-between items-center px-3 py-2 bg-white rounded border text-sm"
                >
                  <span className="font-mono text-xs text-gray-500">{uid.slice(0, 8)}…</span>
                  <span className={amt >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {amt >= 0 ? '+' : ''}{fmt(amt, ccy)}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Activity</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet</p>
        ) : (
          <ul className="space-y-2">
            {events.map(ev => (
              <li key={ev.id} className="px-3 py-2 bg-white rounded border text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>
                {ev.payload.description && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    {ev.payload.description as string}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
