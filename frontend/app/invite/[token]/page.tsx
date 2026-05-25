'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface InviteInfo {
  group_id: string
  group_name: string
  invited_by: string
  expires_at: string
  already_accepted: boolean
}

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const { token } = params
  const router = useRouter()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoggedIn(isLoggedIn())
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
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 bg-surface-variant rounded-full flex items-center justify-center mx-auto text-2xl">
            ✕
          </div>
          <h1 className="text-headline-sm font-bold text-primary">Invite not found</h1>
          <p className="text-sm text-on-surface-muted">
            This link has expired or has already been used.
          </p>
          <Button onClick={() => router.push('/dashboard')} variant="outline" size="md">
            Go to dashboard
          </Button>
        </div>
      </main>
    )
  }

  if (!info) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-on-surface-muted animate-pulse">Loading invite…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-5">
        {/* Brand */}
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight text-primary">Ledgr</span>
        </div>

        <Card>
          <CardBody className="space-y-5">
            {/* Invite context */}
            <div className="text-center space-y-1">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-primary font-bold text-2xl">
                  {info.group_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-on-surface-muted">
                <span className="font-semibold text-on-surface">{info.invited_by}</span>
                {' '}invited you to join
              </p>
              <h1 className="text-subheading font-bold text-primary">{info.group_name}</h1>
              <p className="text-xs text-on-surface-muted pt-1">
                Expires {new Date(info.expires_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
            </div>

            {error && (
              <div className="px-3 py-2.5 bg-owing-bg border border-owing-border rounded text-sm text-owing-dim">
                {error}
              </div>
            )}

            {info.already_accepted ? (
              <div className="space-y-3">
                <p className="text-sm text-on-surface-muted text-center">
                  You&apos;re already a member of this group.
                </p>
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => router.push(`/dashboard/${info.group_id}`)}
                >
                  Go to group
                </Button>
              </div>
            ) : loggedIn ? (
              <Button fullWidth size="lg" loading={loading} onClick={handleAccept}>
                Join {info.group_name}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-on-surface-muted text-center">
                  Sign in to accept this invite.
                </p>
                <Button
                  as="a"
                  fullWidth
                  size="lg"
                  onClick={() => router.push(`/login?next=/invite/${token}`)}
                >
                  Sign in
                </Button>
                <Button
                  fullWidth
                  size="lg"
                  variant="outline"
                  onClick={() => router.push(`/register?next=/invite/${token}`)}
                >
                  Create account
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  )
}
