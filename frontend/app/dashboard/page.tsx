'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { isLoggedIn, clearTokens } from '@/lib/auth'
import { TopNav } from '@/components/layout/top-nav'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Group {
  id: string
  name: string
  default_currency: string
  status: string
}

interface User {
  id: string
  display_name: string
  email: string
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeGroups, setActiveGroups] = useState<Group[]>([])
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCurrency, setNewCurrency] = useState('INR')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return }
    apiFetch('/auth/me').then(r => r.json()).then(setUser)
    apiFetch('/groups?status=active').then(r => r.json()).then(setActiveGroups)
    apiFetch('/groups?status=archived').then(r => r.json()).then(setArchivedGroups)
  }, [router])

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    const res = await apiFetch('/groups', {
      method: 'POST',
      body: JSON.stringify({ name: newName, default_currency: newCurrency }),
    })
    setCreating(false)
    if (!res.ok) { setCreateError('Failed to create group'); return }
    const g: Group = await res.json()
    setActiveGroups(prev => [g, ...prev])
    setNewName('')
    setNewCurrency('INR')
    setShowCreateForm(false)
  }

  function logout() {
    clearTokens()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-surface">
      <TopNav displayName={user?.display_name} onSignOut={logout} />

      <div className="max-w-2xl mx-auto px-4 sm:px-container py-8 space-y-8">

        {/* Page title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-headline-sm font-bold text-primary">Your groups</h1>
            <p className="text-sm text-on-surface-muted mt-0.5">
              {activeGroups.length} active {activeGroups.length === 1 ? 'group' : 'groups'}
            </p>
          </div>
          <Button
            onClick={() => { setShowCreateForm(v => !v); setCreateError('') }}
            size="md"
          >
            {showCreateForm ? 'Cancel' : '+ New group'}
          </Button>
        </div>

        {/* Create group form */}
        {showCreateForm && (
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-on-surface mb-4">New group</h2>
              {createError && (
                <p className="text-sm text-owing-dim bg-owing-bg border border-owing-border rounded px-3 py-2 mb-4">
                  {createError}
                </p>
              )}
              <form onSubmit={createGroup} className="space-y-4">
                <div>
                  <label className="section-label block mb-1.5">Group name</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Trip to Goa"
                    className="input-base"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="section-label block mb-1.5">Default currency</label>
                  <select
                    value={newCurrency}
                    onChange={e => setNewCurrency(e.target.value)}
                    className="input-base"
                  >
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="submit" loading={creating} size="md">
                    Create group
                  </Button>
                  <Button type="button" variant="outline" size="md" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {/* Active groups */}
        <section className="space-y-3">
          {activeGroups.length === 0 && !showCreateForm ? (
            <Card>
              <CardBody className="py-12 text-center">
                <p className="text-on-surface-muted text-sm">No groups yet.</p>
                <p className="text-on-surface-muted text-sm mt-1">
                  Create one to start splitting expenses.
                </p>
                <Button className="mt-5" onClick={() => setShowCreateForm(true)}>
                  + Create your first group
                </Button>
              </CardBody>
            </Card>
          ) : (
            activeGroups.map(g => (
              <Card
                key={g.id}
                hoverable
                onClick={() => router.push(`/dashboard/${g.id}`)}
              >
                <CardBody className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Group initial icon */}
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {g.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface truncate">{g.name}</p>
                      <p className="text-xs text-on-surface-muted mt-0.5">{g.default_currency}</p>
                    </div>
                  </div>
                  <svg className="text-on-surface-muted shrink-0" width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </CardBody>
              </Card>
            ))
          )}
        </section>

        {/* Archived groups */}
        {archivedGroups.length > 0 && (
          <section className="space-y-3">
            <p className="section-label">Archived</p>
            {archivedGroups.map(g => (
              <Card
                key={g.id}
                hoverable
                onClick={() => router.push(`/dashboard/${g.id}`)}
                className="opacity-60"
              >
                <CardBody className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center shrink-0">
                      <span className="text-on-surface-muted font-bold text-sm">
                        {g.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface-muted truncate">{g.name}</p>
                      <p className="text-xs text-on-surface-muted mt-0.5">{g.default_currency}</p>
                    </div>
                  </div>
                  <Badge variant="archived">Archived</Badge>
                </CardBody>
              </Card>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
