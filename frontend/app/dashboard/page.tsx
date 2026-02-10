'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { isLoggedIn, clearTokens } from '@/lib/auth'

interface Group {
  id: string
  name: string
  default_currency: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return }
    apiFetch('/groups').then(r => r.json()).then(setGroups)
  }, [router])

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await apiFetch('/groups', {
      method: 'POST',
      body: JSON.stringify({ name: newName, default_currency: 'USD' }),
    })
    setCreating(false)
    if (res.ok) {
      const g: Group = await res.json()
      setGroups(prev => [...prev, g])
      setNewName('')
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

      <ul className="space-y-2 mb-6">
        {groups.map(g => (
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
        {groups.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No groups yet</p>
        )}
      </ul>

      <form onSubmit={createGroup} className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New group name"
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Create
        </button>
      </form>
    </div>
  )
}
