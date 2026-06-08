const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function tryRefreshTokens(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return true
  } catch {
    return false
  }
}

async function withRefreshRetry(makeRequest: () => Promise<Response>): Promise<Response> {
  let res = await makeRequest()
  if (res.status === 401 && await tryRefreshTokens()) {
    res = await makeRequest()
  }
  return res
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await withRefreshRetry(() => fetch(`${API}${path}`, { headers: authHeaders() }))
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function apiPost<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const bodyStr = JSON.stringify(body)
  const res = await withRefreshRetry(() => fetch(`${API}${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), ...extraHeaders },
    body: bodyStr,
  }))
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const bodyStr = JSON.stringify(body)
  const res = await withRefreshRetry(() => fetch(`${API}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: bodyStr,
  }))
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const bodyStr = JSON.stringify(body)
  const res = await withRefreshRetry(() => fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: bodyStr,
  }))
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function apiDelete(path: string): Promise<void> {
  const res = await withRefreshRetry(() => fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }))
  if (res.status === 401) throw new Error('UNAUTHORIZED')
  if (!res.ok) throw new Error(`API error ${res.status}`)
}

// ── Types ─────────────────────────────────────────────────────────────────

export type Me = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  default_currency: string
  created_at: string
}

export type GroupBalance = {
  group_id: string
  group_name: string
  icon: string | null           // emoji, e.g. "🏖️"
  currency: string              // group's own currency
  net_balance: number           // minor units in group's currency
  net_balance_summary: number   // minor units converted to summary_currency
  summary_currency: string      // e.g. "INR"
}

export type RichActivityEvent = {
  id: string
  group_id: string
  group_name: string
  event_type: string
  event_version: number
  payload: Record<string, unknown>
  actor_user_id: string
  actor_display_name: string
  created_at: string
}

// ── Group detail types ────────────────────────────────────────────────────

export type Group = {
  id: string
  name: string
  icon: string | null
  default_currency: string
  created_by: string
  status: string
  created_at: string
}

export type Member = {
  user_id: string
  display_name: string
  email: string
  role: string
  joined_at: string
}

/** Raw per-user balance map: { user_id: { currency: amount_in_minor_units } } */
export type GroupBalancesDetail = {
  balances: Record<string, Record<string, number>>
}

/** Single event from the group activity log (no actor display_name — join from members). */
export type GroupEvent = {
  id: string
  group_id: string
  event_type: string
  event_version: number
  payload: Record<string, unknown>
  actor_user_id: string
  created_at: string
}

export type SettlementTransaction = {
  from_user: string   // debtor (pays)
  to_user: string     // creditor (receives)
  amount: number
  currency: string
}

export type GroupSettlement = {
  transactions: SettlementTransaction[]
}

// ── Fetchers ──────────────────────────────────────────────────────────────

export const getMe = () => apiFetch<Me>('/auth/me')

export const getGroups = () =>
  apiFetch<Group[]>('/groups')

export const createGroup = (body: { name: string; default_currency: string; icon?: string }) =>
  apiPost<{ id: string }>('/groups', body)

export const getGroupBalances = (summaryCurrency = 'INR') =>
  apiFetch<GroupBalance[]>(`/groups/balances?summary_currency=${summaryCurrency}`)

export const getGlobalActivity = (limit = 20) =>
  apiFetch<RichActivityEvent[]>(`/activity?limit=${limit}`)

// ── Group detail fetchers ─────────────────────────────────────────────────

export const getGroup = (groupId: string) =>
  apiFetch<Group>(`/groups/${groupId}`)

export const getGroupMembers = (groupId: string) =>
  apiFetch<Member[]>(`/groups/${groupId}/members`)

export const getGroupBalancesDetail = (groupId: string) =>
  apiFetch<GroupBalancesDetail>(`/groups/${groupId}/balances`)

export const getGroupActivity = (groupId: string, limit = 100) =>
  apiFetch<GroupEvent[]>(`/groups/${groupId}/activity?limit=${limit}`)

export const getGroupSettlement = (groupId: string) =>
  apiFetch<GroupSettlement>(`/groups/${groupId}/settlement`)

export const recordPayment = (
  groupId: string,
  body: { to_user_id: string; amount: number; currency: string },
) => apiPost<{ id: string }>(`/groups/${groupId}/payments`, body)

// ── Two-step payment flow ─────────────────────────────────────────────────

export type PendingPayment = {
  payment_id: string
  from: string
  to: string
  amount: string    // stored as string in event payload
  currency: string
  created_at: string
}

export const initiatePayment = (
  groupId: string,
  body: { to_user_id: string; amount: number; currency: string },
  idempotencyKey: string,
) => apiPost<{ id: string }>(
  `/groups/${groupId}/payments/initiate`,
  body,
  { 'Idempotency-Key': idempotencyKey },
)

export const confirmPaymentTwoStep = (groupId: string, paymentId: string) =>
  apiPost<{ id: string }>(`/groups/${groupId}/payments/${paymentId}/confirm`, {})

export const getPendingPayments = (groupId: string) =>
  apiFetch<PendingPayment[]>(`/groups/${groupId}/pending-payments`)

export type AddExpenseBody = {
  description: string
  amount: number          // minor units (e.g. 2400 = ₹24.00)
  currency: string
  paid_by?: string        // user_id UUID string; omit to default to current user
  occurred_at?: string    // ISO 8601 datetime string
  split?: Array<{ user_id: string; share: number }> | null  // null = equal split
}

export const addExpense = (groupId: string, body: AddExpenseBody) =>
  apiPost<{ id: string }>(`/groups/${groupId}/expenses`, body)

export const editExpense = (groupId: string, expenseId: string, body: AddExpenseBody) =>
  apiPut<{ id: string }>(`/groups/${groupId}/expenses/${expenseId}`, body)

export const deleteExpense = (groupId: string, expenseId: string) =>
  apiDelete(`/groups/${groupId}/expenses/${expenseId}`)

// ── Invite types & fetchers ───────────────────────────────────────────────

export type MemberPreview = {
  display_name: string
  avatar_url: string | null
}

export type InviteInfo = {
  group_id: string
  group_name: string
  group_icon: string | null
  invited_by: string
  expires_at: string
  already_accepted: boolean
  member_count: number
  member_preview: MemberPreview[]
}

export type InviteLink = {
  id: string
  group_id: string
  token: string
  expires_at: string
}

export const getInviteInfo = (token: string) =>
  apiFetch<InviteInfo>(`/invites/${token}`)

export const acceptInvite = (token: string) =>
  apiPost<{ message: string; group_id: string }>(`/invites/${token}/accept`, {})

export const createInvite = (groupId: string) =>
  apiPost<InviteLink>('/invites', { group_id: groupId })

// ── Friends types & fetchers ──────────────────────────────────────────────

export type FriendshipItem = {
  id: string
  user_id: string
  display_name: string
  email: string
  avatar_url: string | null
  status: string
  is_requester: boolean
  created_at: string
}

export const getFriends = () =>
  apiFetch<FriendshipItem[]>('/users/friends')

export const getFriendRequests = () =>
  apiFetch<FriendshipItem[]>('/users/friends/requests')

export const getSentRequests = () =>
  apiFetch<FriendshipItem[]>('/users/friends/sent')

export const sendFriendRequest = (addresseeId: string) =>
  apiPost<{ message: string }>('/users/friends/request', { addressee_id: addresseeId })

export const acceptFriendRequest = (userId: string) =>
  apiPost<{ message: string }>(`/users/friends/${userId}/accept`, {})

export const declineFriendRequest = (userId: string) =>
  apiPost<{ message: string }>(`/users/friends/${userId}/decline`, {})

export const searchUsers = (q: string) =>
  apiFetch<Array<{ id: string; display_name: string; email: string }>>(`/users/search?q=${encodeURIComponent(q)}`)

// ── Group member management ───────────────────────────────────────────────

export const addGroupMember = (groupId: string, body: { user_id?: string; email?: string }) =>
  apiPost<{ message: string; user_id: string }>(`/groups/${groupId}/members`, body)

export const updateProfile = (body: { display_name: string; default_currency?: string }) =>
  apiPut<Me>('/auth/me', body)

export const archiveGroup = (groupId: string) =>
  apiPatch<{ message: string }>(`/groups/${groupId}/archive`, {})
