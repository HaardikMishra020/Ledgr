'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { setTokens } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (!res.ok) { setError('Invalid email or password'); return }
    const { access_token, refresh_token } = await res.json()
    setTokens(access_token, refresh_token)
    router.push(next)
  }

  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold tracking-tight text-primary">Ledgr</span>
          <p className="text-sm text-on-surface-muted mt-1.5">Split expenses, not friendships.</p>
        </div>

        <Card>
          <CardBody>
            <h1 className="text-base font-semibold text-on-surface mb-5">Sign in to your account</h1>

            {error && (
              <div className="mb-4 px-3 py-2.5 bg-owing-bg border border-owing-border rounded text-sm text-owing-dim">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="section-label block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-base"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="section-label block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-base"
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" loading={loading} fullWidth size="lg" className="mt-2">
                Sign in
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="text-center text-sm text-on-surface-muted mt-6">
          No account?{' '}
          <a
            href={`/register${next !== '/dashboard' ? `?next=${next}` : ''}`}
            className="text-primary font-semibold hover:underline"
          >
            Create one
          </a>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
