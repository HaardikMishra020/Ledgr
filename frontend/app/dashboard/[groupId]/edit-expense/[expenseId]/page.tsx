'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']

interface Member { user_id: string; display_name: string }

function fmtCurrency(minor: number, ccy: string): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(minor / 100) }
  catch { return `${minor / 100} ${ccy}` }
}

export default function EditExpensePage({
  params,
}: {
  params: { groupId: string; expenseId: string }
}) {
  const { groupId, expenseId } = params
  const router = useRouter()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [members, setMembers] = useState<Member[]>([])
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [customAmounts, setCustomAmounts] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    // Load group currency + members
    apiFetch(`/groups/${groupId}`).then(r => r.json()).then(g => setCurrency(g.default_currency ?? 'USD'))

    apiFetch(`/groups/${groupId}/members`).then(r => r.json()).then((ms: Member[]) => {
      setMembers(ms)
      setCustomAmounts(ms.map(() => ''))
    })

    // Load current expense state from activity
    apiFetch(`/groups/${groupId}/activity?limit=200`).then(r => r.json())
      .then((events: { event_type: string; payload: Record<string, unknown> }[]) => {
        const relevant = events.filter(
          ev => (ev.event_type === 'expense_added' || ev.event_type === 'expense_edited')
            && ev.payload.expense_id === expenseId
        )
        const latest = relevant[relevant.length - 1]
        if (!latest) return

        setDescription((latest.payload.description as string) ?? '')
        setAmount(String(Number(latest.payload.amount) / 100))
        setCurrency((latest.payload.currency as string) ?? 'USD')

        // Pre-populate custom split if the existing split is non-equal
        const existingSplit = latest.payload.split as { user_id: string; share: string }[] | undefined
        if (existingSplit && existingSplit.length > 0) {
          const n = existingSplit.length
          const totalMinor = existingSplit.reduce((s, x) => s + Number(x.share), 0)
          const baseShare = Math.floor(totalMinor / n)
          const isEqual = existingSplit.every((s, i) =>
            Number(s.share) === baseShare + (i === 0 ? totalMinor % n : 0)
          )
          if (!isEqual) {
            setSplitMode('custom')
            setCustomAmounts(existingSplit.map(s => (Number(s.share) / 100).toFixed(2)))
          }
        }
      })
  }, [groupId, expenseId])

  const amountMinor = Math.round(parseFloat(amount || '0') * 100)
  const customTotalMinor = customAmounts.reduce((s, a) => s + Math.round(parseFloat(a || '0') * 100), 0)
  const remaining = amountMinor - customTotalMinor

  function switchToCustom() {
    setSplitMode('custom')
    if (!amount || members.length === 0) return
    const n = members.length
    const base = Math.floor(amountMinor / n)
    const rem = amountMinor % n
    setCustomAmounts(members.map((_, i) => ((base + (i === 0 ? rem : 0)) / 100).toFixed(2)))
  }

  function setCustomAmount(i: number, val: string) {
    setCustomAmounts(prev => prev.map((a, idx) => idx === i ? val : a))
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(amountMinor) || amountMinor <= 0) { setError('Enter a valid amount'); return }
    if (splitMode === 'custom' && remaining !== 0) {
      setError(`Split must equal the total. ${remaining > 0 ? `Remaining: ${fmtCurrency(remaining, currency)}` : `Over by: ${fmtCurrency(-remaining, currency)}`}`)
      return
    }

    setSaving(true)
    setError('')

    const body: Record<string, unknown> = { description, amount: amountMinor, currency }
    if (splitMode === 'custom') {
      body.split = members.map((m, i) => ({
        user_id: m.user_id,
        share: Math.round(parseFloat(customAmounts[i] || '0') * 100),
      }))
    }

    const res = await apiFetch(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save changes'); return }
    router.push(`/dashboard/${groupId}`)
  }

  async function handleDelete() {
    if (!confirm('Delete this expense? This appends a deletion event — the original is preserved in history.')) return
    setDeleting(true)
    await apiFetch(`/groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' })
    setDeleting(false)
    router.push(`/dashboard/${groupId}`)
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-xl font-bold">Edit expense</h1>
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
        Editing appends a new <code>expense_edited</code> event — the original is preserved in history.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">{error}</p>
      )}

      <form onSubmit={handleEdit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" step="0.01" min="0.01"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="border rounded px-3 py-2 text-sm">
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Split mode toggle */}
        <div>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setSplitMode('equal')}
              className={`text-xs px-3 py-1.5 rounded border font-medium ${splitMode === 'equal' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              Equal split
            </button>
            <button type="button" onClick={switchToCustom}
              className={`text-xs px-3 py-1.5 rounded border font-medium ${splitMode === 'custom' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              Custom split
            </button>
          </div>

          {splitMode === 'equal' && members.length > 0 && amountMinor > 0 && (
            <p className="text-xs text-gray-400">
              {fmtCurrency(Math.floor(amountMinor / members.length), currency)} per person ({members.length} members)
            </p>
          )}

          {splitMode === 'custom' && members.length > 0 && (
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={m.user_id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-700 truncate">{m.display_name}</span>
                  <input type="number" value={customAmounts[i] ?? ''}
                    onChange={e => setCustomAmount(i, e.target.value)}
                    step="0.01" min="0" placeholder="0.00"
                    className="w-24 border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-xs text-gray-400 w-8">{currency}</span>
                </div>
              ))}
              <div className={`text-xs font-medium pt-1 border-t ${remaining === 0 ? 'text-green-600' : remaining > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                {remaining === 0
                  ? '✓ Splits match total'
                  : remaining > 0
                    ? `Remaining: ${fmtCurrency(remaining, currency)}`
                    : `Over by: ${fmtCurrency(-remaining, currency)}`}
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving || (splitMode === 'custom' && remaining !== 0)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded py-2 text-sm font-medium">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t">
        <button onClick={handleDelete} disabled={deleting}
          className="w-full text-red-600 hover:bg-red-50 border border-red-200 rounded py-2 text-sm font-medium disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Delete expense'}
        </button>
      </div>
    </div>
  )
}
