'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAccessToken } from '@/lib/auth'
import { createGroup } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD']

const EMOJI_OPTIONS = ['🏠', '✈️', '🍕', '🎉', '🏖️', '🏋️', '🎮', '🛒', '💼', '🎓', '❤️', '⚽']

export default function NewGroupPage() {
  const router = useRouter()

  useEffect(() => {
    if (!getAccessToken()) router.replace('/login')
  }, [router])

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [icon, setIcon] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Group name is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const result = await createGroup({
        name: name.trim(),
        default_currency: currency,
        ...(icon ? { icon } : {}),
      })
      router.push(`/dashboard/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="groups" />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 h-16 bg-surface border-b border-outline-variant shadow-sm z-40 flex items-center gap-4 px-container-padding">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </Link>
          <h2 className="font-headline-md text-headline-md font-bold text-primary">New Group</h2>
        </header>

        <div className="flex-1 flex items-start justify-center p-container-padding">
          <div className="w-full max-w-lg">

            {/* Icon picker */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding mb-gutter">
              <p className="font-label-md text-label-md text-on-surface-variant mb-3">Group Icon (optional)</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIcon(null)}
                  className={`w-10 h-10 rounded-lg border-2 text-lg flex items-center justify-center transition-colors ${
                    icon === null
                      ? 'border-primary bg-primary/10'
                      : 'border-outline-variant hover:border-secondary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
                </button>
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-10 h-10 rounded-lg border-2 text-lg flex items-center justify-center transition-colors ${
                      icon === emoji
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant hover:border-secondary'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-gutter">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding space-y-gutter">

                {/* Group name */}
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface-variant mb-base"
                    htmlFor="group-name"
                  >
                    Group Name
                  </label>
                  <input
                    id="group-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Bali Trip, Apartment Expenses"
                    required
                    maxLength={80}
                    className="w-full h-12 px-card-padding rounded-lg bg-surface-container border-none focus:ring-2 focus:ring-secondary transition-all font-body-md text-body-md"
                  />
                </div>

                {/* Default currency */}
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface-variant mb-base"
                    htmlFor="currency"
                  >
                    Default Currency
                  </label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full h-12 px-card-padding rounded-lg bg-surface-container border-none focus:ring-2 focus:ring-secondary transition-all font-body-md text-body-md appearance-none"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-error text-body-md text-center">{error}</p>
              )}

              {/* Preview */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-secondary-container flex items-center justify-center text-2xl shrink-0">
                  {icon ?? <span className="material-symbols-outlined text-on-secondary-container">group</span>}
                </div>
                <div>
                  <p className="font-headline-md text-primary">{name || 'Group Name'}</p>
                  <p className="text-label-md text-on-surface-variant">{currency} · Just you for now</p>
                </div>
              </div>

              <div className="flex gap-element-gap">
                <Link
                  href="/dashboard"
                  className="flex-1 h-12 flex items-center justify-center rounded-lg border border-outline-variant bg-surface font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="flex-1 h-12 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    'Create Group'
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      </main>
    </div>
  )
}
