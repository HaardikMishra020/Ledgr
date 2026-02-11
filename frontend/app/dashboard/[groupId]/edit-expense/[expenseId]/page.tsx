'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']

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
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    const amountMinor = Math.round(parseFloat(amount) * 100)
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount')
      return
    }
    setSaving(true)
    setError('')
    const res = await apiFetch(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify({ description, amount: amountMinor, currency }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to edit expense'); return }
    router.push(`/dashboard/${groupId}`)
  }

  async function handleDelete() {
    if (!confirm('Delete this expense? This appends a deletion event.')) return
    setDeleting(true)
    await apiFetch(`/groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' })
    setDeleting(false)
    router.push(`/dashboard/${groupId}`)
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-bold">Edit expense</h1>
      </div>

      <p className="text-xs text-gray-400 mb-4 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        Editing appends a new <code>expense_edited</code> event — the original is preserved.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleEdit} className="space-y-4">
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <div className="flex gap-3">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount"
            step="0.01"
            min="0.01"
            className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded py-2 text-sm font-medium"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full text-red-600 hover:bg-red-50 border border-red-200 rounded py-2 text-sm font-medium disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete expense'}
        </button>
      </div>
    </div>
  )
}
