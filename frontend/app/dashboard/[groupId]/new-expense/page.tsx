'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { fmtAmount } from '@/lib/fmt'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardDivider } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { PageHeader } from '@/components/layout/top-nav'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']

interface Member { user_id: string; display_name: string }

export default function NewExpensePage({ params }: { params: { groupId: string } }) {
  const { groupId } = params
  const router = useRouter()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [members, setMembers] = useState<Member[]>([])
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [customAmounts, setCustomAmounts] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch(`/groups/${groupId}`)
      .then(r => r.json()).then(g => setCurrency(g.default_currency ?? 'INR'))
    apiFetch(`/groups/${groupId}/members`)
      .then(r => r.json()).then((ms: Member[]) => {
        setMembers(ms)
        setCustomAmounts(ms.map(() => ''))
      })
  }, [groupId])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(amountMinor) || amountMinor <= 0) { setError('Enter a valid amount'); return }
    if (splitMode === 'custom' && remaining !== 0) {
      setError(
        remaining > 0
          ? `Remaining to assign: ${fmtAmount(remaining, currency)}`
          : `Over by: ${fmtAmount(-remaining, currency)}`
      )
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
    const res = await apiFetch(`/groups/${groupId}/expenses`, { method: 'POST', body: JSON.stringify(body) })
    setSaving(false)
    if (!res.ok) { setError('Failed to add expense'); return }
    router.push(`/dashboard/${groupId}`)
  }

  const perPerson = members.length > 0 && amountMinor > 0
    ? fmtAmount(Math.floor(amountMinor / members.length), currency)
    : null

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader
        title="Add expense"
        onBack={() => router.back()}
      />

      <div className="max-w-xl mx-auto px-4 sm:px-container py-8 space-y-5">
        {error && (
          <div className="px-4 py-3 bg-owing-bg border border-owing-border rounded-lg text-sm text-owing-dim">
            {error}
          </div>
        )}

        <Card>
          <CardBody className="space-y-5">
            {/* Amount — hero field */}
            <div>
              <label className="section-label block mb-2">Amount</label>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    className="input-base text-subheading font-semibold"
                    required
                    autoFocus
                  />
                </div>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="input-base w-24 shrink-0"
                >
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="section-label block mb-2">Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Dinner at Namak"
                className="input-base"
                required
              />
            </div>
          </CardBody>

          <CardDivider />

          {/* Split mode */}
          <CardBody className="space-y-4">
            <div>
              <p className="section-label mb-3">Split</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
                    splitMode === 'equal'
                      ? 'bg-primary text-white border-primary'
                      : 'border-outline-variant text-on-surface-muted hover:bg-surface-low'
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={switchToCustom}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
                    splitMode === 'custom'
                      ? 'bg-primary text-white border-primary'
                      : 'border-outline-variant text-on-surface-muted hover:bg-surface-low'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {splitMode === 'equal' && perPerson && (
              <div className="px-4 py-3 bg-surface-low rounded-lg border border-outline-variant">
                <p className="text-sm text-on-surface-muted">
                  <span className="font-semibold text-on-surface">{perPerson}</span>
                  {' '}per person ({members.length} members)
                </p>
              </div>
            )}

            {splitMode === 'custom' && members.length > 0 && (
              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <Avatar name={m.display_name} size="sm" />
                    <span className="flex-1 text-sm text-on-surface truncate">{m.display_name}</span>
                    <input
                      type="number"
                      value={customAmounts[i] ?? ''}
                      onChange={e => setCustomAmount(i, e.target.value)}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="input-base w-28 text-right"
                    />
                    <span className="text-xs text-on-surface-muted w-8 shrink-0">{currency}</span>
                  </div>
                ))}

                {/* Validation feedback */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold border ${
                  remaining === 0
                    ? 'bg-owed-bg border-owed-border text-owed-dim'
                    : 'bg-owing-bg border-owing-border text-owing-dim'
                }`}>
                  {remaining === 0
                    ? '✓ Splits match total'
                    : remaining > 0
                      ? `Remaining: ${fmtAmount(remaining, currency)}`
                      : `Over by: ${fmtAmount(-remaining, currency)}`}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <form onSubmit={handleSubmit}>
          <Button
            type="submit"
            loading={saving}
            fullWidth
            size="lg"
            disabled={splitMode === 'custom' && remaining !== 0}
          >
            Add expense
          </Button>
        </form>
      </div>
    </div>
  )
}
