import React, { useState } from 'react'

// ── Small reusable button ──────────────────────────────────────────────────────
function SwarmBtn({ label, color = '#555', onClick, active = false, disabled = false, small = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '4px 8px' : '6px 0',
        border: '1px solid',
        borderColor: disabled ? '#333' : active ? color : '#444',
        background: disabled ? 'transparent' : active ? color + '33' : 'transparent',
        color: disabled ? '#444' : active ? color : '#888',
        borderRadius: 3,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        fontFamily: 'var(--mono)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: small ? 'auto' : '100%',
        letterSpacing: '0.04em',
        transition: 'all 0.15s',
      }}
      onMouseOver={e => { if (!disabled) e.currentTarget.style.background = color + '22' }}
      onMouseOut={e => { if (!disabled) e.currentTarget.style.background = active ? color + '33' : 'transparent' }}
    >
      {label}
    </button>
  )
}

// ── Badge chip ────────────────────────────────────────────────────────────────
function Badge({ label, value, color = '#00b4d8' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 6px', background: '#111', borderRadius: 3, marginBottom: 2 }}>
      <span style={{ fontSize: 10, color: '#666', fontFamily: 'var(--mono)' }}>{label}</span>
      <span style={{ fontSize: 11, color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{value}</span>
    </div>
  )
}

// ── Per-drone mini row ────────────────────────────────────────────────────────
function DroneRow({ drone }) {
  const batColor = drone.battery < 20 ? '#f44336' : drone.battery < 40 ? '#ff9800' : '#4caf50'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
      background: drone.role === 'leader' ? '#0d1f0d' : '#0d0d0d',
      borderRadius: 3, marginBottom: 2, borderLeft: `2px solid ${drone.role === 'leader' ? '#4caf50' : '#333'}` }}>
      <span style={{ fontSize: 10, color: drone.role === 'leader' ? '#4caf50' : '#00b4d8',
        fontFamily: 'var(--mono)', fontWeight: 700, minWidth: 20 }}>
        #{drone.id}
      </span>
      <span style={{ fontSize: 9, color: '#555', minWidth: 36 }}>{drone.role?.toUpperCase()}</span>
      <span style={{ fontSize: 9, color: '#888', flex: 1, fontFamily: 'var(--mono)' }}>
        {(drone.lat || 0).toFixed(5)}, {(drone.lon || 0).toFixed(5)}
      </span>
      <span style={{ fontSize: 9, color: '#4caf50', minWidth: 30 }}>{(drone.alt || 0).toFixed(1)}m</span>
      <span style={{ fontSize: 9, color: batColor }}>{drone.battery ?? '--'}%</span>
    </div>
  )
}

// ── Main SwarmPanel ────────────────────────────────────────────────────────────
export default function SwarmPanel({ send, swarmData, connected }) {
  const [searchPattern, setSearchPattern]   = useState('spiral')
  const [searchArea, setSearchArea]         = useState(100)
  const [formation, setFormation]           = useState('wedge')
  const [spacing, setSpacing]               = useState(8)
  const [activeMode, setActiveMode]         = useState('idle')

  const drones    = swarmData?.drones   ?? []
  const mode      = swarmData?.swarm_mode ?? 'idle'
  const progress  = swarmData?.search_progress ?? 0
  const droneCount = drones.length

  const swarmCmd = (action, extra = {}) =>
    send({ type: 'swarm_command', action, ...extra })

  const startSearch = () => {
    swarmCmd('start_search', { pattern: searchPattern, area_size: searchArea })
    setActiveMode('search')
  }

  const startFormation = () => {
    swarmCmd('start_formation', { formation, spacing })
    setActiveMode('formation')
  }

  const startFlocking = () => {
    swarmCmd('start_flocking')
    setActiveMode('flocking')
  }

  const stopAll = () => {
    swarmCmd('stop')
    setActiveMode('idle')
  }

  // ── Mode color helpers ─────────────────────────────────────────────────────
  const modeColor = {
    idle:      '#555',
    search:    '#ffd600',
    formation: '#00b4d8',
    flocking:  '#e040fb',
  }[mode] || '#555'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
      gap: 0, fontFamily: 'var(--mono)', fontSize: 11 }}>

      {/* ── Status Header ──────────────────────────────────────────────────── */}
      <div style={{ padding: '6px 8px', background: '#0a0a0a', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: mode !== 'idle' ? modeColor : '#333',
          boxShadow: mode !== 'idle' ? `0 0 6px ${modeColor}` : 'none',
          transition: 'all 0.3s' }} />
        <span style={{ color: modeColor, fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>
          SWARM
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>
          {mode.toUpperCase()}
        </span>
      </div>

      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* ── Overview badges ──────────────────────────────────────────────── */}
        <Badge label="DRONES ONLINE"  value={droneCount}                        color="#00b4d8" />
        <Badge label="SWARM MODE"     value={mode.toUpperCase()}                color={modeColor} />
        {mode === 'search' && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#555' }}>SEARCH PROGRESS</span>
              <span style={{ fontSize: 9, color: '#ffd600' }}>{(progress * 100).toFixed(1)}%</span>
            </div>
            <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress * 100}%`,
                background: '#ffd600', borderRadius: 2, transition: 'width 0.5s' }} />
            </div>
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* ── Search Pattern ────────────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 4 }}>Search Pattern</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 4 }}>
            {['spiral','lawnmower','sector'].map(p => (
              <SwarmBtn key={p} label={p} small
                active={searchPattern === p}
                color="#ffd600"
                onClick={() => setSearchPattern(p)} />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#555' }}>AREA</span>
            <input type="number" min={20} max={1000} step={10} value={searchArea}
              onChange={e => setSearchArea(+e.target.value)}
              style={{ width: 60, padding: '2px 4px', background: '#111', border: '1px solid #333',
                color: '#ccc', borderRadius: 3, fontSize: 11, textAlign: 'center', fontFamily: 'var(--mono)' }} />
            <span style={{ fontSize: 9, color: '#555' }}>m</span>
          </div>

          <SwarmBtn label="▶ START SEARCH" color="#ffd600"
            active={mode === 'search'}
            disabled={!connected}
            onClick={startSearch} />
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* ── Formation Control ─────────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 4 }}>Formation</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
            {['wedge','line','grid','circle'].map(f => (
              <SwarmBtn key={f} label={f} small
                active={formation === f}
                color="#00b4d8"
                onClick={() => setFormation(f)} />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#555' }}>SPACING</span>
            <input type="number" min={3} max={50} step={1} value={spacing}
              onChange={e => setSpacing(+e.target.value)}
              style={{ width: 50, padding: '2px 4px', background: '#111', border: '1px solid #333',
                color: '#ccc', borderRadius: 3, fontSize: 11, textAlign: 'center', fontFamily: 'var(--mono)' }} />
            <span style={{ fontSize: 9, color: '#555' }}>m</span>
          </div>

          <SwarmBtn label="▶ HOLD FORMATION" color="#00b4d8"
            active={mode === 'formation'}
            disabled={!connected}
            onClick={startFormation} />
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* ── Flocking ─────────────────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 4 }}>Flocking (Boids)</div>
          <div style={{ fontSize: 9, color: '#444', lineHeight: 1.6, marginBottom: 4 }}>
            Cohesion · Separation · Alignment
          </div>
          <SwarmBtn label="▶ START FLOCKING" color="#e040fb"
            active={mode === 'flocking'}
            disabled={!connected}
            onClick={startFlocking} />
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* ── Stop all ─────────────────────────────────────────────────────── */}
        <SwarmBtn label="⬛ STOP ALL" color="#f44336"
          disabled={mode === 'idle' || !connected}
          onClick={stopAll} />

        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* ── Drone list ───────────────────────────────────────────────────── */}
        {drones.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 4 }}>
              Swarm Drones ({drones.length})
            </div>
            {drones.map(d => <DroneRow key={d.id} drone={d} />)}
          </div>
        )}

        {drones.length === 0 && (
          <div style={{ padding: '10px 0', textAlign: 'center', color: '#333', fontSize: 10 }}>
            No drones in swarm yet.<br />
            <span style={{ color: '#222' }}>Drones appear when telemetry is received.</span>
          </div>
        )}
      </div>
    </div>
  )
}