'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { getAccessToken } from '@/lib/auth'
import { getInviteInfo, acceptInvite } from '@/lib/api'
import type { InviteInfo } from '@/lib/api'

function InvitePageInner() {
  const params = useParams()
  const router = useRouter()
  const token = String(params.token)

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Reactive auth state — re-evaluated after returning from login/signup
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Join modal + join flow state
  const [showModal, setShowModal] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Check auth once on mount (client-side only)
  useEffect(() => {
    setIsLoggedIn(!!getAccessToken())
  }, [])

  // Fetch invite info
  useEffect(() => {
    getInviteInfo(token)
      .then(setInfo)
      .catch(() => setNotFound(true))
      .finally(() => setLoadingInfo(false))
  }, [token])

  // Auto-open join modal once we have both auth + info
  useEffect(() => {
    if (isLoggedIn && info && !info.already_accepted) {
      setShowModal(true)
    }
  }, [isLoggedIn, info])

  async function handleJoin() {
    setJoining(true)
    setJoinError('')
    try {
      const res = await acceptInvite(token)
      setJoined(true)
      setTimeout(() => router.push(`/dashboard/${res.group_id}`), 1400)
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setJoining(false)
    }
  }

  if (loadingInfo) {
    return (
      <div className="min-h-screen trip-bg flex items-center justify-center pt-16">
        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen trip-bg flex items-center justify-center px-container-padding pt-16">
        <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding tonal-elevation text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-4 block">link_off</span>
          <h1 className="font-headline-md text-headline-md text-primary mb-2">Invite not found</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            This invite link has expired or is no longer valid.
          </p>
          <Link
            href="/dashboard"
            className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold inline-block active:scale-95 transition-transform"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Join confirmation modal (logged-in state) ─────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-container-padding">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
            onClick={() => !joining && !joined && setShowModal(false)}
          />

          {/* Modal card */}
          <div className="relative z-10 w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden tonal-elevation animate-invite-in">
            {/* Accent bar */}
            <div className="h-1.5 bg-secondary w-full" />

            <div className="p-card-padding flex flex-col items-center text-center">
              {/* Group icon */}
              <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-gutter mt-2">
                {info?.group_icon ? (
                  <span className="text-3xl">{info.group_icon}</span>
                ) : (
                  <span
                    className="material-symbols-outlined text-secondary text-4xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    group
                  </span>
                )}
              </div>

              <p className="font-body-md text-body-md text-on-surface-variant mb-1">You&apos;ve been invited to join</p>
              <h2 className="font-headline-md text-headline-md text-primary mb-1">{info?.group_name}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-gutter">
                by <span className="font-bold text-on-surface">{info?.invited_by}</span>
              </p>

              {/* Member avatars */}
              {info && info.member_count > 0 && (
                <div className="flex items-center gap-2 mb-gutter">
                  <div className="flex -space-x-2">
                    {info.member_preview.slice(0, 3).map((m, i) =>
                      m.avatar_url ? (
                        <img
                          key={i}
                          src={m.avatar_url}
                          alt={m.display_name}
                          className="w-8 h-8 rounded-full border-2 border-surface-container-lowest object-cover"
                        />
                      ) : (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-secondary-container flex items-center justify-center text-[11px] font-bold text-on-secondary-container"
                        >
                          {m.display_name.charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                    {info.member_count > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-primary-fixed-dim flex items-center justify-center text-[11px] font-bold text-on-primary-fixed-variant">
                        +{info.member_count - 3}
                      </div>
                    )}
                  </div>
                  <p className="text-label-md font-label-md text-on-surface-variant">
                    {info.member_count} member{info.member_count !== 1 ? 's' : ''} already inside
                  </p>
                </div>
              )}

              {joinError && (
                <p className="text-error text-label-md font-label-md mb-gutter w-full">{joinError}</p>
              )}

              {joined ? (
                <div className="w-full bg-secondary-container text-on-secondary-container py-4 rounded-lg font-bold flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Joined! Taking you there…
                </div>
              ) : (
                <div className="w-full space-y-3">
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-primary text-on-primary font-body-lg text-body-lg py-4 rounded-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {joining ? (
                      <span className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Join Group</span>
                        <span className="material-symbols-outlined">chevron_right</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={joining}
                    className="w-full py-2 text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors"
                  >
                    Not now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Invite info card (background) ─────────────────────────────────── */}
      <div className="min-h-screen trip-bg flex items-center justify-center pt-16 px-container-padding">
        <div className="max-w-md w-full animate-invite-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding tonal-elevation relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-secondary" />

            <div className="flex flex-col items-center text-center mt-4">
              {/* Group icon */}
              <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-gutter hover:scale-105 transition-transform duration-300">
                {info?.group_icon ? (
                  <span className="text-3xl">{info.group_icon}</span>
                ) : (
                  <span
                    className="material-symbols-outlined text-secondary text-4xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    flight_takeoff
                  </span>
                )}
              </div>

              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary mb-2">
                You&apos;ve been invited to join:
              </h1>
              <p className="font-headline-md text-headline-md text-secondary mb-gutter">
                {info?.group_name}
              </p>

              {/* Members */}
              {info && info.member_count > 0 && (
                <div className="w-full bg-surface-container-low rounded-lg p-gutter mb-gutter border border-outline-variant/30">
                  <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest mb-element-gap">
                    Joined Members
                  </p>
                  <div className="flex flex-wrap justify-center -space-x-3 mb-element-gap">
                    {info.member_preview.slice(0, 3).map((m, i) =>
                      m.avatar_url ? (
                        <img
                          key={i}
                          src={m.avatar_url}
                          alt={m.display_name}
                          className="w-10 h-10 rounded-full border-2 border-surface-container-lowest object-cover"
                        />
                      ) : (
                        <div
                          key={i}
                          className="w-10 h-10 rounded-full border-2 border-surface-container-lowest bg-secondary-container flex items-center justify-center text-label-md font-label-md text-on-secondary-container"
                        >
                          {m.display_name.charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                    {info.member_count > 3 && (
                      <div className="w-10 h-10 rounded-full border-2 border-surface-container-lowest bg-primary-fixed-dim flex items-center justify-center text-label-md font-label-md text-on-primary-fixed-variant">
                        +{info.member_count - 3}
                      </div>
                    )}
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {info.member_preview[0]?.display_name}
                    {info.member_preview[1] ? `, ${info.member_preview[1].display_name}` : ''}
                    {info.member_count > 2
                      ? ` and ${info.member_count - 2} others are already tracking expenses.`
                      : ' is already tracking expenses.'}
                  </p>
                </div>
              )}

              <p className="font-body-md text-body-md text-on-surface-variant mb-gutter">
                Invited by <span className="font-bold text-on-surface">{info?.invited_by}</span>
              </p>

              {/* CTA depending on auth state */}
              {info?.already_accepted ? (
                <Link
                  href={`/dashboard/${info.group_id}`}
                  className="w-full bg-secondary text-on-secondary font-body-lg text-body-lg py-4 rounded-lg active:scale-95 transition-all duration-200 mb-gutter flex items-center justify-center gap-2"
                >
                  Already a member — Go to Group
                  <span className="material-symbols-outlined">chevron_right</span>
                </Link>
              ) : isLoggedIn ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full bg-primary text-on-primary font-body-lg text-body-lg py-4 rounded-lg active:scale-95 transition-all duration-200 shadow-lg shadow-primary/10 mb-gutter flex items-center justify-center gap-2"
                >
                  <span>Join Group</span>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push(`/login?next=/invite/${token}`)}
                    className="w-full bg-primary text-on-primary font-body-lg text-body-lg py-4 rounded-lg active:scale-95 transition-all duration-200 shadow-lg shadow-primary/10 mb-gutter flex items-center justify-center gap-2"
                  >
                    <span>Join Group</span>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>

                  <div className="w-full h-px bg-outline-variant/30 mb-gutter" />

                  <div className="w-full space-y-element-gap">
                    <Link
                      href={`/login?next=/invite/${token}`}
                      className="w-full text-secondary font-body-md text-body-md py-2 border border-secondary rounded-lg hover:bg-secondary-container/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[20px]">login</span>
                      Sign in to Join
                    </Link>
                    <p className="text-label-md font-label-md text-on-surface-variant">
                      Don&apos;t have an account?{' '}
                      <Link
                        href={`/login?mode=signup&next=/invite/${token}`}
                        className="text-secondary font-bold hover:underline"
                      >
                        Create one
                      </Link>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <footer className="mt-8 text-center">
            <p className="text-label-md font-label-md text-on-surface-variant/60">
              © 2024 Ledgr Inc. • Fiscal Clarity for Groups
            </p>
          </footer>
        </div>
      </div>
    </>
  )
}

export default function InvitePage() {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-container-padding h-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-headline-md font-extrabold text-primary tracking-tight">Ledgr</span>
            <span className="text-label-md font-label-md bg-secondary-fixed text-on-secondary-fixed-variant px-2 py-0.5 rounded-full">
              INVITE
            </span>
          </div>
          <span className="text-label-md font-label-md text-on-surface-variant/60">Ledgr</span>
        </div>
      </header>
      <Suspense>
        <InvitePageInner />
      </Suspense>
    </>
  )
}
