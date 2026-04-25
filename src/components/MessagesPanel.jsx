import React, { useEffect, useRef } from 'react'

const SEV_COLOR = {
  EMERGENCY:'#f44336', ALERT:'#f44336', CRITICAL:'#f44336',
  ERROR:'#ff5722', WARNING:'#ffd600', NOTICE:'#00b4d8',
  INFO:'#aaa', DEBUG:'#666'
}

export default function MessagesPanel({ messages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages.length])

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:6, fontFamily:'var(--mono)', fontSize:11 }}>
      {messages.length === 0 && (
        <div style={{ color:'var(--muted)', padding:8, textAlign:'center' }}>No messages yet…</div>
      )}
      {messages.map((m, i) => (
        <div key={i} style={{ display:'flex', gap:8, padding:'2px 0', borderBottom:'1px solid #2a2a2a', alignItems:'baseline' }}>
          <span style={{ color:'#555', flexShrink:0, fontSize:10 }}>{m.time}</span>
          <span style={{ color: SEV_COLOR[m.severity_str] || '#aaa', flexShrink:0, width:70, fontSize:10 }}>[{m.severity_str}]</span>
          <span style={{ color:'#ccc', wordBreak:'break-word' }}>{m.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
