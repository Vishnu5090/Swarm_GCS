import { useEffect, useRef, useCallback } from 'react'

export function useWebSocket(url, onMessage) {
  const ws = useRef(null)
  const onMsg = useRef(onMessage)
  const retryTimer = useRef(null)
  onMsg.current = onMessage

useEffect(() => {
  let cancelled = false
  const retryTimer = { current: null }

  const connect = () => {
    if (cancelled) return
    const sock = new WebSocket(url)
    ws.current = sock
    sock.onmessage = e => { try { onMsg.current(JSON.parse(e.data)) } catch {} }
    sock.onclose   = () => {
      if (!cancelled) retryTimer.current = setTimeout(connect, 2000)
    }
    sock.onerror = () => sock.close()
  }
  connect()

  return () => {
    cancelled = true
    clearTimeout(retryTimer.current)
    if (ws.current) {
      ws.current.onclose = null
      ws.current.close()
      ws.current = null
    }
  }
}, [url])

  const send = useCallback(obj => {
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify(obj))
  }, [])

  return send
}
