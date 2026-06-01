'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAccessToken } from '@/lib/auth'
import {
  getMe,
  getFriends,
  getFriendRequests,
  getSentRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
} from '@/lib/api'
import type { Me, FriendshipItem } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'

type SearchUser = { id: string; display_name: string; email: string }

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function FriendsPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [friends, setFriends] = useState<FriendshipItem[]>([])
  const [incoming, setIncoming] = useState<FriendshipItem[]>([])
  const [sent, setSent] = useState<FriendshipItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }
    Promise.all([getMe(), getFriends(), getFriendRequests(), getSentRequests()])
      .then(([meData, friendsData, incomingData, sentData]) => {
        setMe(meData)
        setFriends(friendsData)
        setIncoming(incomingData)
        setSent(sentData)
      })
      .catch(err => {
        if (err instanceof Error && err.message === 'UNAUTHORIZED') router.replace('/login')
      })
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchUsers(searchQuery)
        const friendIds = new Set(friends.map(f => f.user_id))
        const sentSet = new Set(sent.map(s => s.user_id))
        setSearchResults(res.filter(u => !friendIds.has(u.id) && !sentSet.has(u.id)))
      } catch { /* ignore */ }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, friends, sent])

  async function handleSendRequest(userId: string) {
    setSendingTo(userId)
    try {
      await sendFriendRequest(userId)
      setSentIds(prev => new Set(prev).add(userId))
      setSearchResults(prev => prev.filter(u => u.id !== userId))
    } catch { /* ignore */ }
    finally { setSendingTo(null) }
  }

  async function handleAccept(userId: string) {
    try {
      await acceptFriendRequest(userId)
      const accepted = incoming.find(r => r.user_id === userId)
      if (accepted) setFriends(prev => [...prev, { ...accepted, status: 'accepted' }])
      setIncoming(prev => prev.filter(r => r.user_id !== userId))
    } catch { /* ignore */ }
  }

  async function handleDecline(userId: string) {
    try {
      await declineFriendRequest(userId)
      setIncoming(prev => prev.filter(r => r.user_id !== userId))
    } catch { /* ignore */ }
  }

  const pendingCount = incoming.length + sent.length

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="friends" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 h-16 bg-surface border-b border-outline-variant shadow-sm z-40 flex items-center justify-between px-gutter">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input
              className="w-full h-10 pl-12 pr-4 bg-surface-container border-none rounded-full font-body-md text-body-md focus:ring-2 focus:ring-secondary/20"
              placeholder="Search friends or transactions..."
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            {me && (
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-label-md font-label-md text-on-secondary-container border border-outline-variant">
                {initials(me.display_name)}
              </div>
            )}
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-container-padding py-8">
        <div className="max-w-7xl mx-auto space-y-gutter">
          {/* Page header */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary">Manage Friends</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Build your financial network with friends and colleagues.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-gutter">
              {/* Left: search + suggestions */}
              <div className="col-span-12 lg:col-span-8 space-y-gutter">
                {/* Add a Friend */}
                <div className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-lg tonal-elevation">
                  <h3 className="font-headline-md text-headline-md text-primary mb-4">Add a Friend</h3>
                  <div className="flex gap-element-gap">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">alternate_email</span>
                      <input
                        className="w-full h-12 pl-12 pr-4 bg-surface-container border-none rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-secondary"
                        placeholder="Search by name or email address"
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                    {searching && (
                      <div className="flex items-center justify-center px-4">
                        <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Search results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {searchResults.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-4 border border-outline-variant rounded-lg hover:border-secondary transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold">
                              {initials(user.display_name)}
                            </div>
                            <div>
                              <p className="font-headline-md text-[16px] text-primary">{user.display_name}</p>
                              <p className="text-label-md font-label-md text-on-surface-variant">{user.email}</p>
                            </div>
                          </div>
                          {sentIds.has(user.id) ? (
                            <span className="flex items-center gap-1 bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full text-label-md font-label-md">
                              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              Invited
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSendRequest(user.id)}
                              disabled={sendingTo === user.id}
                              className="flex items-center gap-1 bg-secondary text-on-secondary px-4 py-2 rounded-full text-label-md font-label-md active:scale-95 transition-all disabled:opacity-60"
                            >
                              <span className="material-symbols-outlined text-[18px]">person_add</span>
                              Add Friend
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current Friends */}
                {friends.length > 0 && (
                  <div className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-lg tonal-elevation">
                    <h3 className="font-headline-md text-headline-md text-primary mb-6">Your Friends</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-element-gap">
                      {friends.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-4 border border-outline-variant rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold overflow-hidden">
                              {f.avatar_url ? (
                                <img src={f.avatar_url} alt={f.display_name} className="w-full h-full object-cover" />
                              ) : (
                                initials(f.display_name)
                              )}
                            </div>
                            <div>
                              <p className="font-headline-md text-[16px] text-primary">{f.display_name}</p>
                              <p className="text-label-md font-label-md text-on-surface-variant">{f.email}</p>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full text-label-md font-label-md">
                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            Friends
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {friends.length === 0 && searchResults.length === 0 && (
                  <div className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-lg tonal-elevation">
                    <div className="flex flex-col items-center py-12 text-center opacity-40">
                      <span className="material-symbols-outlined text-[64px] mb-2">diversity_3</span>
                      <p className="font-body-md text-body-md">Search for friends to add them to your network</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: pending requests */}
              <div className="col-span-12 lg:col-span-4 space-y-gutter">
                <div className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-lg tonal-elevation h-full">
                  <h3 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
                    Pending Requests
                    {pendingCount > 0 && (
                      <span className="bg-secondary-fixed text-on-secondary-fixed text-[12px] px-2 py-0.5 rounded-full font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </h3>

                  <div className="space-y-6">
                    {/* Incoming */}
                    {incoming.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">Received</p>
                        {incoming.map(req => (
                          <div key={req.id} className="p-4 bg-surface-container-low rounded-lg border border-outline-variant">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center text-primary font-bold">
                                {initials(req.display_name)}
                              </div>
                              <div>
                                <p className="font-headline-md text-[14px] text-primary">{req.display_name}</p>
                                <p className="text-label-md font-label-md text-on-surface-variant">{req.email}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAccept(req.user_id)}
                                className="flex-1 bg-primary text-on-primary py-2 rounded-lg text-label-md font-label-md active:scale-95 transition-all"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDecline(req.user_id)}
                                className="flex-1 bg-surface text-primary border border-outline-variant py-2 rounded-lg text-label-md font-label-md active:scale-95 transition-all"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sent */}
                    {sent.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">Sent</p>
                        {sent.map(req => (
                          <div key={req.id} className="flex items-center justify-between p-4 border border-dashed border-outline-variant rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant font-bold opacity-60">
                                {initials(req.display_name)}
                              </div>
                              <div>
                                <p className="font-headline-md text-[14px] text-primary">{req.display_name}</p>
                                <p className="text-label-md font-label-md text-on-secondary-container flex items-center gap-1 italic">
                                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                                  Invited
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pendingCount === 0 && (
                      <div className="mt-6 flex flex-col items-center justify-center text-center opacity-20">
                        <span className="material-symbols-outlined text-[48px] mb-2">diversity_3</span>
                        <p className="font-body-md text-body-md">Your circle is growing</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <footer className="w-full py-8 mt-12 border-t border-outline-variant">
            <p className="font-label-md text-label-md text-on-surface-variant">© 2024 Ledgr Inc. All rights reserved.</p>
          </footer>
        </div>
        </main>
      </div>
    </div>
  )
}
