const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export type TokenPair = { access_token: string; refresh_token: string }

export async function apiLogin(email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'Login failed')
  return data
}

export async function apiRegister(
  email: string,
  password: string,
  display_name: string,
): Promise<TokenPair> {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'Registration failed')
  return data
}

export function saveTokens(pair: TokenPair) {
  localStorage.setItem('access_token', pair.access_token)
  localStorage.setItem('refresh_token', pair.refresh_token)
  // Presence-only cookie so middleware can gate protected routes server-side.
  // The actual token never leaves localStorage.
  document.cookie = 'ledgr_logged_in=1; path=/; SameSite=Lax; max-age=604800'
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

export function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  document.cookie = 'ledgr_logged_in=; path=/; SameSite=Lax; max-age=0'
}

export async function logout(): Promise<void> {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
  if (refreshToken) {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {})  // clear tokens even if the server call fails
  }
  clearTokens()
}
