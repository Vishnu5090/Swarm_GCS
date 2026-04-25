import React, { useState } from 'react'

export default function ConnectionBar({ connected, connInfo, send }) {
  const [proto, setProto]   = useState('TCP')
  const [host, setHost]     = useState('127.0.0.1')
  const [port, setPort]     = useState(5760)

  const connect = () => send({ type:'connect', proto, host, port: +port })
  const disconnect = () => send({ type:'disconnect' })

  const inp = (value, set, w=100) => (
    <input value={value} onChange={e => set(e.target.value)}
      style={{ width:w, padding:'2px 6px', background:'#111', border:'1px solid #444',
        color:'#ccc', borderRadius:3, fontSize:12, fontFamily:'var(--mono)' }} />
  )

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 12px',
      background:'#111', borderBottom:'2px solid var(--border)', height:42, flexShrink:0 }}>

      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:10 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background: connected ? '#4caf50' : '#555',
          boxShadow: connected ? '0 0 6px #4caf50' : 'none', transition:'all 0.3s' }} />
        <span style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:'var(--accent)', letterSpacing:2 }}>GCS</span>
      </div>

      {/* Protocol */}
      <select value={proto} onChange={e => setProto(e.target.value)} disabled={connected}
        style={{ padding:'2px 6px', background:'#111', border:'1px solid #444', color:'#ccc', borderRadius:3, fontSize:12 }}>
        <option>TCP</option>
        <option>UDP</option>
      </select>

      {/* Host */}
      {proto === 'TCP' && (
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ color:'var(--muted)', fontSize:11 }}>HOST</span>
          {inp(host, setHost, 110)}
        </div>
      )}

      {/* Port */}
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <span style={{ color:'var(--muted)', fontSize:11 }}>{proto==='UDP' ? 'LISTEN PORT' : 'PORT'}</span>
        {inp(port, setPort, 70)}
      </div>

      {/* Connect / Disconnect */}
      {!connected ? (
        <button onClick={connect} style={{ padding:'3px 14px', background:'#4caf50', border:'none', borderRadius:3,
          color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:1 }}>
          CONNECT
        </button>
      ) : (
        <button onClick={disconnect} style={{ padding:'3px 14px', background:'#f44336', border:'none', borderRadius:3,
          color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:1 }}>
          DISCONNECT
        </button>
      )}

      {/* Connection info */}
      {connected && connInfo && (
        <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'#4caf50' }}>
          {connInfo.proto} {connInfo.host ? `${connInfo.host}:` : 'PORT '}{connInfo.port}
        </span>
      )}

      {/* Hint for UDP */}
      {!connected && proto === 'UDP' && (
        <span style={{ fontSize:10, color:'#555' }}>
          Add <code style={{color:'#888'}}>--out=127.0.0.1:{port}</code> to sim_vehicle
        </span>
      )}

      <div style={{ marginLeft:'auto', display:'flex', gap:16, alignItems:'center' }}>
        <span style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)' }}>
          ArduPilot Ground Control Station
        </span>
      </div>
    </div>
  )
}
