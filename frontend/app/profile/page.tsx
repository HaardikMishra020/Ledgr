'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAccessToken, logout } from '@/lib/auth'
import { getMe, updateProfile } from '@/lib/api'
import type { Me } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

function AvatarCircle({ name, avatarUrl, size = 'lg' }: { name: string; avatarUrl: string | null; size?: 'sm' | 'lg' }) {
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const dim = size === 'lg' ? 'w-32 h-32 text-2xl' : 'w-8 h-8 text-label-md'
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${dim} rounded-full object-cover`} />
  }
  return (
    <div className={`${dim} rounded-full bg-secondary-container text-on-secondary-container font-bold flex items-center justify-center flex-shrink-0`}>
      {initials || '?'}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  // Editable fields
  const [displayName, setDisplayName] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Notification toggle state (UI-only)
  const [emailUpdates, setEmailUpdates] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(false)

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }
    getMe()
      .then(data => {
        setMe(data)
        setDisplayName(data.display_name)
        setDefaultCurrency(data.default_currency ?? 'USD')
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSave() {
    if (!displayName.trim() || !me) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const updated = await updateProfile({ display_name: displayName.trim(), default_currency: defaultCurrency })
      setMe(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-secondary text-4xl">progress_activity</span>
      </div>
    )
  }

  const isDirty =
    displayName.trim() !== (me?.display_name ?? '') ||
    defaultCurrency !== (me?.default_currency ?? 'USD')

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="settings" />

      <main className="flex-1 min-w-0 pt-0 pb-20 md:pb-0">
        {/* Top bar */}
        <header className="flex justify-between items-center px-container-padding h-16 w-full bg-surface border-b border-outline-variant shadow-sm sticky top-0 z-10">
          <div>
            <h2 className="text-headline-md font-headline-md font-bold text-primary">Profile Settings</h2>
            <p className="text-label-md text-on-surface-variant hidden sm:block">Manage your identity and preferences</p>
          </div>
          <div className="flex items-center gap-3">
            {me && <AvatarCircle name={me.display_name} avatarUrl={me.avatar_url} size="sm" />}
          </div>
        </header>

        <div className="p-container-padding max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">

            {/* ── Left column ──────────────────────────────────────── */}
            <div className="lg:col-span-8 space-y-gutter">

              {/* Identity card */}
              <section className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl tonal-elevation">
                <div className="flex flex-col md:flex-row items-start gap-8">
                  {/* Avatar */}
                  <div className="relative group flex-shrink-0">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-container border-2 border-secondary p-1">
                      <div className="w-full h-full rounded-full overflow-hidden">
                        {me && <AvatarCircle name={me.display_name} avatarUrl={me.avatar_url} size="lg" />}
                      </div>
                    </div>
                    {/* Avatar edit placeholder — no upload backend connected yet */}
                    <div
                      className="absolute bottom-1 right-1 bg-primary text-white p-2 rounded-full shadow-md opacity-40 cursor-not-allowed"
                      title="Avatar upload coming soon"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div className="space-y-2">
                      <label className="text-label-md font-label-md text-on-surface-variant">Full Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg focus:border-secondary focus:ring-0 text-body-md outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-label-md font-label-md text-on-surface-variant">Email Address</label>
                      <input
                        type="email"
                        value={me?.email ?? ''}
                        readOnly
                        className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-lg text-body-md text-on-surface-variant cursor-default"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-label-md font-label-md text-on-surface-variant">Default Currency</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">currency_exchange</span>
                        <select
                          value={defaultCurrency}
                          onChange={e => setDefaultCurrency(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg focus:border-secondary focus:ring-0 text-body-md outline-none transition-colors appearance-none"
                        >
                          {['USD','EUR','GBP','INR','JPY','CAD','AUD','CHF','CNY','SGD'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-label-md font-label-md text-on-surface-variant">Member since</label>
                      <p className="text-body-md text-on-surface-variant px-1 py-3">
                        {me ? new Date(me.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save row */}
                <div className="mt-6 flex items-center gap-4 justify-end border-t border-outline-variant pt-4">
                  {saveError && <p className="text-error text-label-md">{saveError}</p>}
                  {saveSuccess && (
                    <p className="text-secondary text-label-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Saved
                    </p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                    className="px-6 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </section>

              {/* Security card */}
              <section className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl tonal-elevation">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Security</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-outline-variant/30">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary">lock</span>
                      <div>
                        <p className="font-body-md font-bold">Password</p>
                        <p className="text-label-md font-label-md text-on-surface-variant">Change your account password</p>
                      </div>
                    </div>
                    <button
                      className="px-4 py-2 border border-outline text-body-md font-bold rounded-lg hover:bg-surface-container transition-colors opacity-50 cursor-not-allowed"
                      title="Password change not yet available"
                      disabled
                    >
                      Change
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-outline-variant/30">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary">verified_user</span>
                      <div>
                        <p className="font-body-md font-bold">Two-Factor Authentication</p>
                        <p className="text-label-md font-label-md text-on-surface-variant">Enhanced account protection</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-not-allowed opacity-50">
                      <input type="checkbox" className="sr-only peer" disabled />
                      <div className="w-11 h-6 bg-surface-dim rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary" />
                    </label>
                  </div>
                </div>
              </section>
            </div>

            {/* ── Right column ─────────────────────────────────────── */}
            <div className="lg:col-span-4 space-y-gutter">

              {/* Notifications card */}
              <section className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl tonal-elevation">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Notifications</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-body-md font-bold">Email Updates</span>
                      <span className="text-label-md text-on-surface-variant">Weekly digest and balance reports</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={emailUpdates}
                        onChange={e => setEmailUpdates(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-surface-dim rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-body-md font-bold">Push Notifications</span>
                      <span className="text-label-md text-on-surface-variant">Instant settlement alerts</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={pushNotifs}
                        onChange={e => setPushNotifs(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-surface-dim rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary" />
                    </label>
                  </div>
                </div>
              </section>

              {/* Account actions card */}
              <section className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl tonal-elevation">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Account</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 bg-surface rounded-lg border border-outline-variant hover:bg-surface-container transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant">logout</span>
                    <span className="text-body-md">Log out of Ledgr</span>
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="mt-12 border-t border-outline-variant pt-8">
            <div className="bg-error-container/20 border border-error/20 p-card-padding rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-headline-md text-headline-md text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">report_problem</span>
                  Danger Zone
                </h3>
                <p className="text-on-surface-variant font-body-md text-body-md">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
              </div>
              <button
                disabled
                className="px-6 py-3 bg-error text-on-error font-bold rounded-lg opacity-40 cursor-not-allowed"
                title="Account deletion not yet available"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </main>
      <BottomNav active="profile" />
    </div>
  )
}
