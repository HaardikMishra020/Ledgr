const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    window.location.href = '/login'
  }

  return res
}
