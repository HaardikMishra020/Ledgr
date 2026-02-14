'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { isLoggedIn, clearTokens } from '@/lib/auth'

interface Group {
  id: string
  name: string
  default_currency: string
  status: string
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']

export default function DashboardPage() {
  const router = useRouter()
  const [activeGroups, setActiveGroups] = useState<Group[]>([])
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([])
  const [newName, setNewName] = useState('')
  const [newCurrency, setNewCurrency] = useState('USD')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return }
    apiFetch('/groups?status=active').then(r => r.json()).then(setActiveGroups)
    apiFetch('/groups?status=archived').then(r => r.json()).then(setArchivedGroups)
  }, [router])

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await apiFetch('/groups', {
      method: 'POST',
      body: JSON.stringify({ name: newName, default_currency: newCurrency }),
    })
    setCreating(false)
    if (res.ok) {
      const g: Group = await res.json()
      setActiveGroups(prev => [...prev, g])
      setNewName('')
      setNewCurrency('USD')
    }
  }

  function logout() {
    clearTokens()
    router.push('/login')
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">
          Sign out
        </button>
      </div>

      {/* Active groups */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Active
        </h2>
        <ul className="space-y-2">
          {activeGroups.map(g => (
            <li key={g.id}>
              <button
                onClick={() => router.push(`/dashboard/${g.id}`)}
                className="w-full text-left px-4 py-3 bg-white rounded-lg border hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <span className="font-medium">{g.name}</span>
                <span className="ml-2 text-xs text-gray-400">{g.default_currency}</span>
              </button>
            </li>
          ))}
          {activeGroups.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No active groups</p>
          )}
        </ul>
      </section>

      {/* Create group */}
      <form onSubmit={createGroup} className="flex gap-2 mb-8">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New group name"
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <select
          value={newCurrency}
          onChange={e => setNewCurrency(e.target.value)}
          className="border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button
          type="submit"
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Create
        </button>
      </form>

      {/* Archived groups */}
      {archivedGroups.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Archived
          </h2>
          <ul className="space-y-2">
            {archivedGroups.map(g => (
              <li key={g.id}>
                <button
                  onClick={() => router.push(`/dashboard/${g.id}`)}
                  className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all"
                >
                  <span className="font-medium text-gray-500">{g.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{g.default_currency}</span>
                  <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">archived</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
