import React, { useState, useEffect } from 'react'

const MODES = ['STABILIZE', 'ACRO', 'ALT_HOLD', 'AUTO', 'GUIDED', 'LOITER', 'RTL', 'CIRCLE', 'LAND', 'POSHOLD', 'BRAKE', 'SMART_RTL']

function Btn({ label, color = '#333', onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 0',
        border: '1px solid',
        borderColor: disabled ? '#444' : color,
        background: disabled ? 'transparent' : `${color}22`,
        color: disabled ? '#666' : color,
        borderRadius: 3,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        width: '100%',
      }}
      onMouseOver={e => { if (!disabled) e.currentTarget.style.background = `${color}44` }}
      onMouseOut={e => { if (!disabled) e.currentTarget.style.background = `${color}22` }}
    >
      {label}
    </button>
  )
}

export default function ActionsPanel({ send, telemetry, connected = false, linkReady = false }) {
  const [takeoffAlt, setTakeoffAlt] = useState(10)
  const armed = telemetry.armed
  const currentMode = telemetry.mode || ''
  const commandBlocked = !connected || !linkReady

  const [pendingMode, setPendingMode] = useState(currentMode)
  useEffect(() => { setPendingMode(currentMode) }, [currentMode])

  const cmd = (command, extra = {}) => send({ type: 'command', command, ...extra })

  const handleModeChange = (e) => {
    const mode = e.target.value
    setPendingMode(mode)
    cmd('set_mode', { mode })
  }

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Btn label="ARM" color="#4caf50" onClick={() => cmd('arm')} disabled={armed || commandBlocked} />
        <Btn label="DISARM" color="#f44336" onClick={() => cmd('disarm')} disabled={!armed || commandBlocked} />
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="number"
          min={1}
          max={200}
          value={takeoffAlt}
          onChange={e => setTakeoffAlt(+e.target.value)}
          style={{
            width: 54,
            padding: '4px 6px',
            background: '#1a1a1a',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 3,
            fontSize: 12,
            textAlign: 'center',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>m</span>
        <Btn label="TAKEOFF" color="#ffd600" onClick={() => cmd('takeoff', { alt: takeoffAlt })} disabled={!armed || commandBlocked} />
      </div>

      {commandBlocked ? (
        <div style={{ fontSize: 10, color: '#555', marginTop: -2 }}>
          Waiting for live telemetry before commands are available
        </div>
      ) : !armed ? (
        <div style={{ fontSize: 10, color: '#555', marginTop: -2 }}>
          Arm the vehicle before takeoff
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Btn label="LAND" color="#00b4d8" onClick={() => cmd('land')} disabled={commandBlocked} />
        <Btn label="RTL" color="#ff9800" onClick={() => cmd('rtl')} disabled={commandBlocked} />
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Flight Mode
        </div>
        <select
          value={pendingMode}
          onChange={handleModeChange}
          disabled={commandBlocked}
          style={{
            width: '100%',
            padding: '5px 8px',
            background: '#1a1a1a',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 3,
            fontSize: 12,
          }}
        >
          {!MODES.includes(pendingMode) && (
            <option value={pendingMode} disabled>{pendingMode || 'Unknown mode'}</option>
          )}
          {MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 'auto', padding: '6px 8px', background: '#111', borderRadius: 3, fontSize: 11, fontFamily: 'var(--mono)' }}>
        <div style={{ color: 'var(--muted)' }}>CURRENT MODE</div>
        <div style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{telemetry.mode || 'UNKNOWN'}</div>
        <div style={{ color: 'var(--muted)', marginTop: 4 }}>STATUS</div>
        <div style={{ color: armed ? '#ffd600' : '#f44336', fontWeight: 'bold' }}>{armed ? 'ARMED' : 'DISARMED'}</div>
      </div>
    </div>
  )
}
