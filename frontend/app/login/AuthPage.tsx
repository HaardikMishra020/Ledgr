'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiLogin, apiRegister, saveTokens } from '@/lib/auth'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setMode('signup')
  }, [searchParams])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const password = fd.get('password') as string
    try {
      let tokens
      if (mode === 'signup') {
        const display_name = (fd.get('name') as string).trim()
        if (!display_name) { setError('Full name is required'); setLoading(false); return }
        tokens = await apiRegister(email, password, display_name)
      } else {
        tokens = await apiLogin(email, password)
      }
      saveTokens(tokens)
      const next = searchParams.get('next')
      router.push(next || '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <main className="flex min-h-screen bg-surface text-on-surface">
      {/* ── Left Panel: Branded Graphic (desktop only) ─────────────────── */}
      <section className="hidden lg:flex lg:w-1/2 relative bg-primary-container items-center justify-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Abstract financial clarity artwork"
            className="w-full h-full object-cover opacity-60 grayscale mix-blend-overlay"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6Mc4WIMc6XIlLJEFJveOugxNfciTBiaR3BCH4zr_vuv0KHxYw32qTt6oGBUlIY9MZWtDYEUAu3klld2VPQPwznQ4zeX9ObwPw9NnhbvHMBAIGfC298xkHPByjapHoAhdvsRDoSuzai4-9ANECS-Oxh_PC4F0ScyApGEwHCIow0urPFOUqHVIPjstyq3-Gzb_UOUxMHS18W0VvjgtCF-JV6IMf4l-OGHv1EFe6UJz8VBprFqQE4570gdLP0-0SF5mIAtrWixnUv94"
          />
        </div>

        <div className="relative z-10 p-24 max-w-2xl">
          {/* Logo */}
          <div className="mb-12">
            <span className="text-on-primary font-headline-md text-headline-md tracking-tight block mb-2">
              Ledgr
            </span>
            <div className="h-1 w-12 bg-secondary" />
          </div>

          <h1 className="font-headline-lg text-headline-lg text-on-primary mb-6">
            Master the art of{' '}
            <span className="text-secondary-fixed">fiscal clarity.</span>
          </h1>

          <p className="font-body-lg text-body-lg text-on-primary-container leading-relaxed">
            Experience a systematic approach to wealth tracking. Ledgr provides
            the precision you need to harmonize your finances with bento-style
            organization and real-time insights.
          </p>

          {/* Feature highlights */}
          <div className="mt-16 flex flex-col gap-4">
            {[
              { icon: 'call_split', text: 'Split expenses evenly or by custom amounts' },
              { icon: 'currency_exchange', text: 'FX conversion at market rates' },
              { icon: 'check_circle', text: 'Two-step payment confirmation flow' },
            ].map(({ icon, text }) => (
              <div key={icon} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary-fixed text-lg">{icon}</span>
                <span className="text-on-primary font-body-md text-body-md">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </section>

      {/* ── Right Panel: Form ───────────────────────────────────────────── */}
      <section className="w-full lg:w-1/2 flex items-center justify-center p-container-padding bg-surface">
        <div className="w-full max-w-md">
          {/* Back to home + mobile logo */}
          <div className="mb-12 flex items-center justify-between">
            <div className="lg:hidden flex items-center gap-base">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-white"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance_wallet
                </span>
              </div>
              <span className="font-headline-md text-headline-md text-primary">Ledgr</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md ml-auto"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Home
            </Link>
          </div>

          {/* Form header */}
          <div className="mb-gutter">
            <h2 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg mb-2">
              {isSignup ? 'Create an account' : 'Welcome back'}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {isSignup
                ? 'Start your journey to financial harmony today.'
                : 'Enter your details to access your dashboard.'}
            </p>
          </div>

          {/* Login / Sign Up toggle pill */}
          <div className="bg-surface-container-low p-1 rounded-xl flex mb-gutter relative">
            <div
              className="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-surface-container-lowest rounded-lg tonal-elevation auth-transition"
              style={{ transform: isSignup ? 'translateX(100%)' : 'translateX(0)' }}
            />
            <button
              type="button"
              className={`flex-1 py-2 font-label-md text-label-md relative z-10 auth-transition ${
                !isSignup ? 'text-primary' : 'text-on-surface-variant'
              }`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 py-2 font-label-md text-label-md relative z-10 auth-transition ${
                isSignup ? 'text-primary' : 'text-on-surface-variant'
              }`}
              onClick={() => setMode('signup')}
            >
              Sign Up
            </button>
          </div>

          {/* Auth form */}
          <form className="space-y-gutter" onSubmit={handleSubmit}>
            {/* Name field — signup only */}
            <div
              className={`auth-transition overflow-hidden ${
                isSignup ? 'opacity-100 h-[80px]' : 'opacity-0 h-0'
              }`}
            >
              <label
                className="block font-label-md text-label-md text-on-surface-variant mb-base"
                htmlFor="name"
              >
                Full Name
              </label>
              <input
                className="w-full h-12 px-card-padding rounded-lg bg-surface-container border-none focus:ring-2 focus:ring-secondary transition-all font-body-md text-body-md"
                id="name"
                name="name"
                placeholder="John Doe"
                type="text"
              />
            </div>

            <div>
              <label
                className="block font-label-md text-label-md text-on-surface-variant mb-base"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                className="w-full h-12 px-card-padding rounded-lg bg-surface-container border-none focus:ring-2 focus:ring-secondary transition-all font-body-md text-body-md"
                id="email"
                name="email"
                placeholder="name@company.com"
                required
                type="email"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-base">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="password"
                >
                  Password
                </label>
                {!isSignup && (
                  <span className="font-label-md text-label-md text-on-surface-variant/50">Forgot?</span>
                )}
              </div>
              <input
                className="w-full h-12 px-card-padding rounded-lg bg-surface-container border-none focus:ring-2 focus:ring-secondary transition-all font-body-md text-body-md"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type="password"
              />
            </div>

            {error && (
              <p className="text-body-md text-error text-center -mb-2">{error}</p>
            )}

            <button
              className="w-full bg-primary text-on-primary h-12 rounded-lg font-headline-md text-headline-md active:scale-[0.98] transition-transform hover:bg-zinc-800 flex items-center justify-center disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              ) : isSignup ? (
                'Get Started'
              ) : (
                'Log In'
              )}
            </button>
          </form>

        </div>
      </section>
    </main>
  )
}
