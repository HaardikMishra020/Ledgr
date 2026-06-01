import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="bg-background text-on-surface">
      {/* ── Top App Bar ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 w-full h-16 z-50 bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-container-padding">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white">account_balance_wallet</span>
            </div>
            <div>
              <h1 className="text-headline-md font-headline-md font-bold text-primary leading-tight">Ledgr</h1>
              <p className="text-label-md font-label-md text-on-surface-variant leading-tight">Fiscal Clarity</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-lg text-body-lg" href="#features">Features</a>
            <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-lg text-body-lg" href="#cta">Get Started</a>
          </nav>

          <div className="flex items-center gap-element-gap">
            <Link
              href="/login"
              className="font-body-md text-body-md text-on-surface-variant hover:text-secondary transition-colors px-3 py-2"
            >
              Log In
            </Link>
            <Link
              href="/login?mode=signup"
              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-16 px-container-padding max-w-7xl mx-auto">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="grid lg:grid-cols-2 gap-12 items-center mb-24">
          <div className="space-y-gutter">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md">
              Multi-currency expense splitting
            </div>

            <h1 className="font-headline-lg text-headline-lg md:text-[56px] md:leading-[64px] tracking-tight">
              Fiscal Clarity for{' '}
              <span className="text-secondary">Shared Expenses.</span>
            </h1>

            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
              Stop the guesswork. Ledgr provides a systematic, transparent way
              to track, split, and settle debts with friends, roommates, and
              travel partners.
            </p>

            <div className="flex flex-wrap gap-element-gap pt-base">
              <Link
                href="/login?mode=signup"
                className="bg-primary text-on-primary px-8 py-3 rounded-lg font-headline-md text-body-lg hover:opacity-90 active:scale-95 transition-all"
              >
                Get Started for Free
              </Link>
              <Link
                href="/login"
                className="border border-outline-variant bg-surface-container-lowest text-on-surface px-8 py-3 rounded-lg font-headline-md text-body-lg hover:bg-surface-container transition-all active:scale-95"
              >
                Log In
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square rounded-3xl overflow-hidden tonal-elevation border border-outline-variant bg-white">
              <img
                alt="Two people reviewing shared expenses on smartphones with a handwritten ledger"
                className="w-full h-full object-cover object-top"
                src="/hero.png"
              />
            </div>

            {/* Floating settlement card */}
            <div className="absolute -bottom-6 -left-6 bg-white p-card-padding rounded-xl tonal-elevation border border-outline-variant max-w-[240px] animate-bounce-slow">
              <div className="flex items-center gap-base mb-2">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Settle-up successful
                </span>
              </div>
              <div className="font-amount-display text-amount-display text-primary">$42.50</div>
              <div className="text-label-md text-on-surface-variant">Sent to Michael Chen</div>
            </div>
          </div>
        </section>

        {/* ── Features Bento Grid ───────────────────────────────────────── */}
        <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {/* Feature 1 — Smart Splitting (wide) */}
          <div className="md:col-span-2 bg-surface-container-lowest p-card-padding rounded-xl border border-outline-variant tonal-elevation group hover:border-secondary transition-colors">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-secondary-container flex items-center justify-center mb-gutter">
                  <span className="material-symbols-outlined text-on-secondary-container">
                    call_split
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md mb-base">Smart Splitting</h3>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                  Ledgr handles equal splits, custom per-person amounts, and
                  uneven distributions. Add expenses in seconds, see who owes
                  what instantly.
                </p>
              </div>

              <div className="mt-8 overflow-hidden rounded-lg border border-outline-variant">
                <div className="bg-surface-container p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center bg-white p-3 rounded shadow-sm">
                    <span className="font-body-md text-body-md">Dinner at Lucca&apos;s</span>
                    <span className="font-bold text-secondary">+$84.00</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/50 p-3 rounded">
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      You owe Sarah
                    </span>
                    <span className="font-body-md text-body-md text-error">-$28.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 — Real-time FX */}
          <div className="bg-surface-container-lowest p-card-padding rounded-xl border border-outline-variant tonal-elevation group hover:border-secondary transition-colors">
            <div className="w-12 h-12 rounded-lg bg-secondary-container flex items-center justify-center mb-gutter">
              <span className="material-symbols-outlined text-on-secondary-container">
                currency_exchange
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md mb-base">Real-time FX</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Traveling abroad? Ledgr fetches mid-market FX rates so your
              expenses are always converted correctly. No manual math on
              vacation.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center py-8">
              <div className="flex items-center gap-4 text-headline-md font-bold">
                <span>EUR</span>
                <span className="material-symbols-outlined text-on-surface-variant">
                  arrow_forward
                </span>
                <span>USD</span>
              </div>
              <div className="text-label-md text-secondary mt-2">Rate: 1.0824</div>
            </div>
          </div>

          {/* Feature 3 — Optimized Settlements */}
          <div className="bg-surface-container-lowest p-card-padding rounded-xl border border-outline-variant tonal-elevation group hover:border-secondary transition-colors">
            <div className="w-12 h-12 rounded-lg bg-secondary-container flex items-center justify-center mb-gutter">
              <span className="material-symbols-outlined text-on-secondary-container">
                account_balance_wallet
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md mb-base">Optimized Settlements</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Minimizes the number of transactions needed to clear all balances
              within your group.
            </p>
            <div className="mt-gutter flex -space-x-3">
              <div className="w-10 h-10 rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center text-label-md">
                JD
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center text-label-md">
                AS
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-white bg-secondary-fixed flex items-center justify-center text-label-md">
                ME
              </div>
            </div>
          </div>

          {/* Feature 4 — Trust & Security (wide, dark) */}
          <div className="md:col-span-2 bg-primary text-on-primary p-card-padding rounded-xl tonal-elevation flex flex-col md:flex-row items-center gap-gutter overflow-hidden relative">
            <div className="flex-1 z-10">
              <h3 className="font-headline-md text-headline-md mb-base text-white">
                Trust &amp; Security
              </h3>
              <p className="font-body-md text-body-md text-primary-fixed-dim">
                Your data stays yours. Passwords are hashed, tokens are
                short-lived, and no financial data is shared with third parties.
              </p>
              <div className="mt-gutter flex gap-base">
                <span className="material-symbols-outlined text-secondary-fixed">
                  lock
                </span>
                <span className="font-label-md text-label-md">Secure by default</span>
              </div>
            </div>
            <div className="flex-1 opacity-20 transform translate-x-8 translate-y-8 pointer-events-none">
              <span className="material-symbols-outlined text-[180px]">security</span>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section id="cta" className="mt-24 bg-surface-container p-12 rounded-3xl text-center border border-outline-variant">
          <h2 className="font-headline-lg text-headline-lg mb-gutter">
            Start splitting expenses today.
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-xl mx-auto">
            Free to use. No credit card required. Start splitting expenses with
            your group in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-element-gap">
            <Link
              href="/login?mode=signup"
              className="bg-primary text-on-primary px-10 py-4 rounded-lg font-headline-md text-body-lg active:scale-95 transition-all"
            >
              Get Started for Free
            </Link>
            <Link
              href="/login"
              className="bg-white border border-outline-variant text-on-surface px-10 py-4 rounded-lg font-headline-md text-body-lg active:scale-95 transition-all"
            >
              Log In
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="w-full py-8 border-t border-outline-variant bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-container-padding flex flex-col md:flex-row justify-between items-center gap-gutter">
          <div className="flex flex-col items-center md:items-start">
            <span className="font-headline-md text-headline-md font-bold text-primary mb-2">
              Ledgr
            </span>
            <p className="font-label-md text-label-md text-on-surface-variant">
              © 2026 Ledgr. All rights reserved.
            </p>
          </div>
          <div className="flex gap-gutter">
            <span className="font-label-md text-label-md text-on-surface-variant/50">Privacy Policy</span>
            <span className="font-label-md text-label-md text-on-surface-variant/50">Terms of Service</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
