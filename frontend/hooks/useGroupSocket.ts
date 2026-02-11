import { useEffect, useRef, useState } from 'react'

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'

export function useGroupSocket(groupId: string, onEvent: () => void) {
  const [connected, setConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (typeof window === 'undefined') return

    const token = localStorage.getItem('access_token')
    if (!token) return

    const ws = new WebSocket(`${WS_BASE}/groups/${groupId}/ws?token=${token}`)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = () => onEventRef.current()

    return () => ws.close()
  }, [groupId])

  return { connected }
}
