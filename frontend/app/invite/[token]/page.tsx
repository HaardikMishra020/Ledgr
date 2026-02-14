'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface InviteInfo {
  group_id: string
  group_name: string
  invited_by: string
  expires_at: string
  already_accepted: boolean
}

export default function AcceptInvitePage({
  params,
}: {
  params: { token: string }
}) {
  const { token } = params
  const router = useRouter()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoggedIn(isLoggedIn())
    // Public fetch — no auth header needed
    fetch(`${API}/invites/${token}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then(d => d && setInfo(d))
  }, [token])

  async function handleAccept() {
    setLoading(true)
    setError('')
    const res = await apiFetch(`/invites/${token}/accept`, { method: 'POST' })
    setLoading(false)

    if (res.status === 400) {
      const data = await res.json()
      if (data.detail === 'already a member') {
        router.push(`/dashboard/${info?.group_id}`)
        return
      }
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.detail ?? 'Something went wrong.')
      return
    }
    const data = await res.json()
    router.push(`/dashboard/${data.group_id}`)
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-gray-700">Invite not found</h1>
          <p className="text-sm text-gray-400">This link has expired or already been used.</p>
          <a href="/dashboard" className="text-indigo-600 text-sm hover:underline">Go to dashboard</a>
        </div>
      </main>
    )
  }

  if (!info) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading invite…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{info.invited_by}</span> invited you to join
          </p>
          <h1 className="text-2xl font-bold">{info.group_name}</h1>
          <p className="text-xs text-gray-400">
            Expires {new Date(info.expires_at).toLocaleDateString()}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        {info.already_accepted ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">This invite has already been accepted.</p>
            <a href={`/dashboard/${info.group_id}`}
               className="block w-full text-center bg-indigo-600 text-white rounded py-2.5 font-medium hover:bg-indigo-700">
              Go to group
            </a>
          </div>
        ) : loggedIn ? (
          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded py-2.5 font-medium"
          >
            {loading ? 'Joining…' : `Join ${info.group_name}`}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Sign in to accept this invite.</p>
            <a
              href={`/login?next=/invite/${token}`}
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded py-2.5 font-medium text-center"
            >
              Sign in
            </a>
            <a
              href={`/register?next=/invite/${token}`}
              className="block w-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded py-2.5 font-medium text-center"
            >
              Create account
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
