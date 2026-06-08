'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { getAccessToken } from '@/lib/auth'
import {
  getMe,
  getGroup,
  getGroupMembers,
  getFriends,
  createInvite,
  addGroupMember,
  searchUsers,
  sendFriendRequest,
} from '@/lib/api'
import type { Me, Group, Member, FriendshipItem } from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function AddMembersInner() {
  const params = useParams()
  const router = useRouter()
  const groupId = String(params.groupId)

  const [me, setMe] = useState<Me | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [friends, setFriends] = useState<FriendshipItem[]>([])
  const [loading, setLoading] = useState(true)

  const [emailInput, setEmailInput] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  const [inviteLink, setInviteLink] = useState('')
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addingMembers, setAddingMembers] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)

  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; display_name: string; email: string }>>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return }
    Promise.all([getMe(), getGroup(groupId), getGroupMembers(groupId), getFriends()])
      .then(([meData, groupData, membersData, friendsData]) => {
        setMe(meData)
        setGroup(groupData)
        setMembers(membersData)
        const memberIds = new Set(membersData.map((m: Member) => m.user_id))
        setFriends(friendsData.filter((f: FriendshipItem) => !memberIds.has(f.user_id)))
      })
      .catch(err => {
        if (err instanceof Error && err.message === 'UNAUTHORIZED') router.replace('/login')
      })
      .finally(() => setLoading(false))
  }, [groupId, router])

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const memberIds = new Set(members.map(m => m.user_id))
        const friendIds = new Set(friends.map(f => f.user_id))
        const res = await searchUsers(searchQ)
        setSearchResults(res.filter(u => !memberIds.has(u.id) && !friendIds.has(u.id)))
      } catch { /* ignore */ }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ, members, friends])

  async function handleGenerateLink() {
    setGeneratingLink(true)
    try {
      const res = await createInvite(groupId)
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      setInviteLink(`${base}/invite/${res.token}`)
    } catch { /* ignore */ }
    finally { setGeneratingLink(false) }
  }

  async function handleCopyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleSendEmailInvite() {
    if (!emailInput.trim()) return
    setSendingEmail(true)
    setEmailError('')
    try {
      // Search for user by email and send friend request or add directly
      const res = await searchUsers(emailInput)
      const match = res.find(u => u.email === emailInput)
      if (match) {
        await addGroupMember(groupId, { user_id: match.id })
        setEmailSent(true)
        setEmailInput('')
        // Refresh members
        const updated = await getGroupMembers(groupId)
        setMembers(updated)
      } else {
        // Generate invite link for non-user
        const inv = await createInvite(groupId)
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        setInviteLink(`${base}/invite/${inv.token}`)
        setEmailSent(true)
        setEmailInput('')
      }
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to send invitation')
    } finally {
      setSendingEmail(false)
    }
  }

  function toggleSelect(userId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleAddToGroup() {
    if (selected.size === 0) return
    setAddingMembers(true)
    try {
      await Promise.all(Array.from(selected).map(uid => addGroupMember(groupId, { user_id: uid })))
      setAddSuccess(true)
      setSelected(new Set())
      const updated = await getGroupMembers(groupId)
      setMembers(updated)
      const memberIds = new Set(updated.map((m: Member) => m.user_id))
      setFriends(prev => prev.filter(f => !memberIds.has(f.user_id)))
      setTimeout(() => setAddSuccess(false), 2000)
    } catch { /* ignore */ }
    finally { setAddingMembers(false) }
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active="groups" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 h-16 bg-surface border-b border-outline-variant shadow-sm z-40 flex items-center justify-between px-container-padding">
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <input
                className="w-64 pl-10 pr-4 py-2 bg-surface-container rounded-full border-none focus:ring-2 focus:ring-secondary text-body-md"
                placeholder="Search members..."
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant">search</span>
            </div>
          </div>
          <div className="flex items-center gap-element-gap">
            {me && (
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-label-md font-label-md text-on-secondary-container border border-outline-variant overflow-hidden">
                {me && initials(me.display_name)}
              </div>
            )}
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 pb-24 md:pb-8 px-container-padding py-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <section className="mb-gutter">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <nav className="flex items-center text-label-md text-on-surface-variant mb-2">
                <Link href="/dashboard" className="hover:text-secondary">Groups</Link>
                <span className="material-symbols-outlined text-[14px] mx-1">chevron_right</span>
                <Link href={`/dashboard/${groupId}`} className="hover:text-secondary">
                  {group?.name ?? '…'}
                </Link>
                <span className="material-symbols-outlined text-[14px] mx-1">chevron_right</span>
                <span className="text-secondary">Add Members</span>
              </nav>
              <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Add Group Members</h2>
              <p className="font-body-md text-on-surface-variant mt-1">
                Grow your group to manage shared expenses with ease.
              </p>
            </div>
            <div className="bg-secondary-fixed px-4 py-2 rounded-lg flex items-center gap-2 tonal-elevation">
              <span className="material-symbols-outlined text-on-secondary-fixed-variant">group</span>
              <span className="font-label-md text-on-secondary-fixed">{members.length} MEMBERS CURRENTLY</span>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            {/* Left: invite options */}
            <div className="lg:col-span-1 space-y-gutter">
              {/* Invite via email */}
              <div className="bg-surface-container-lowest p-card-padding rounded-xl border border-outline-variant tonal-elevation">
                <h3 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">mail</span>
                  Invite via Email
                </h3>
                <p className="font-body-md text-on-surface-variant mb-gutter">
                  Send a direct invitation to someone not on Ledgr yet.
                </p>
                <div className="space-y-3">
                  <input
                    className="w-full px-4 py-3 bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary text-body-md"
                    placeholder="email@address.com"
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                  />
                  {emailError && <p className="text-error text-label-md font-label-md">{emailError}</p>}
                  {emailSent && (
                    <p className="text-secondary text-label-md font-label-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Invitation sent!
                    </p>
                  )}
                  <button
                    onClick={handleSendEmailInvite}
                    disabled={sendingEmail || !emailInput.trim()}
                    className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                  >
                    {sendingEmail ? 'Sending…' : 'Send Invitation'}
                  </button>
                </div>
              </div>

              {/* Share invite link */}
              <div className="bg-surface-container-lowest p-card-padding rounded-xl border border-outline-variant tonal-elevation overflow-hidden relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-headline-md text-headline-md">Share Invite Link</h3>
                  <span className="material-symbols-outlined text-secondary">link</span>
                </div>
                <p className="font-body-md text-on-surface-variant mb-4 text-sm">
                  Anyone with this link can join &apos;{group?.name}&apos;.
                </p>
                {inviteLink ? (
                  <div className="flex items-center gap-2 bg-surface-container p-3 rounded-lg">
                    <code className="text-xs truncate text-on-surface-variant flex-1">{inviteLink}</code>
                    <button
                      onClick={handleCopyLink}
                      className="ml-auto text-secondary hover:text-on-secondary-container transition-colors flex-shrink-0"
                    >
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: linkCopied ? "'FILL' 1" : "'FILL' 0" }}>
                        {linkCopied ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                    className="w-full bg-surface-container text-on-surface-variant py-3 rounded-lg font-bold hover:bg-surface-container-high transition-colors text-body-md disabled:opacity-60"
                  >
                    {generatingLink ? 'Generating…' : 'Generate Link'}
                  </button>
                )}
              </div>
            </div>

            {/* Right: friends multi-select */}
            <div className="lg:col-span-2">
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant tonal-elevation h-full flex flex-col">
                <div className="p-card-padding border-b border-outline-variant flex items-center justify-between">
                  <div>
                    <h3 className="font-headline-md text-headline-md">Select from Friends</h3>
                    <p className="font-body-md text-on-surface-variant">Choose friends to add to this group.</p>
                  </div>
                  {searching && (
                    <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] p-card-padding custom-scrollbar">
                  {/* Search results (non-friends) */}
                  {searchResults.length > 0 && (
                    <div className="mb-4">
                      <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Search Results</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {searchResults.map(u => (
                          <div
                            key={u.id}
                            className="flex items-center gap-4 p-3 rounded-lg border border-outline-variant cursor-pointer hover:border-secondary hover:bg-surface transition-all"
                            onClick={async () => {
                              try { await sendFriendRequest(u.id) } catch { /* ignore */ }
                            }}
                          >
                            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-on-surface-variant">
                              {initials(u.display_name)}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-body-md">{u.display_name}</p>
                              <p className="text-xs text-on-surface-variant">{u.email}</p>
                            </div>
                            <button className="text-secondary text-label-md font-label-md hover:underline">
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Friends list */}
                  {friends.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {friends.map(f => {
                        const isSelected = selected.has(f.user_id)
                        return (
                          <div
                            key={f.id}
                            onClick={() => toggleSelect(f.user_id)}
                            className={`group flex items-center gap-4 p-3 rounded-lg border cursor-pointer relative transition-all ${
                              isSelected
                                ? 'border-secondary bg-secondary-container/20'
                                : 'border-transparent hover:border-secondary hover:bg-surface'
                            }`}
                          >
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold">
                                {f.avatar_url ? (
                                  <img src={f.avatar_url} alt={f.display_name} className="w-full h-full object-cover" />
                                ) : (
                                  initials(f.display_name)
                                )}
                              </div>
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-body-md">{f.display_name}</p>
                              <p className="text-xs text-on-surface-variant">{f.email}</p>
                            </div>
                            <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-secondary border-secondary' : 'border-outline-variant'
                            }`}>
                              <span
                                className="material-symbols-outlined text-[18px] text-white transition-opacity"
                                style={{
                                  fontVariationSettings: "'FILL' 1",
                                  opacity: isSelected ? 1 : 0,
                                }}
                              >
                                check
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                      <span className="material-symbols-outlined text-[48px] mb-2">group_add</span>
                      <p className="font-body-md text-body-md">
                        {friends.length === 0 && searchQ.length < 2
                          ? 'All your friends are already in this group, or you have no friends yet. Search above to find people.'
                          : 'No results found.'}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Action bar */}
                <div className="p-card-padding bg-surface-container-low rounded-b-xl border-t border-outline-variant flex items-center justify-between">
                  <span className="font-label-md text-on-surface-variant uppercase">
                    {selected.size} {selected.size === 1 ? 'FRIEND' : 'FRIENDS'} SELECTED
                  </span>
                  <div className="flex gap-3">
                    <Link
                      href={`/dashboard/${groupId}`}
                      className="px-6 py-2 rounded-lg border border-outline-variant font-bold text-body-md hover:bg-surface-container-high transition-colors"
                    >
                      Cancel
                    </Link>
                    <button
                      onClick={handleAddToGroup}
                      disabled={selected.size === 0 || addingMembers}
                      className={`px-6 py-2 rounded-lg bg-secondary text-on-secondary font-bold text-body-md active:scale-95 transition-all ${
                        selected.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {addSuccess ? (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          Added!
                        </span>
                      ) : addingMembers ? 'Adding…' : 'Add to Group'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </main>

        <BottomNav active="dashboard" />
      </div>
    </div>
  )
}

export default function AddMembersPage() {
  return (
    <Suspense>
      <AddMembersInner />
    </Suspense>
  )
}
