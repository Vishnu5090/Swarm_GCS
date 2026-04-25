import React, { useState, useRef, useEffect } from 'react'

export const DRONE_COLORS = [
  '#ff5a36', '#00e5ff', '#69ff47', '#ff1744',
  '#ffd600', '#d500f9', '#ff6d00', '#00e676',
]

// ── Small helpers ─────────────────────────────────────────────────────────────
function Pill({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 3,
      border: `1px solid ${color}`, color, background: bg || `${color}18`,
      fontFamily: 'var(--mono)', fontWeight: 700, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function Btn({ label, color = '#555', onClick, disabled = false, flex = false, small = false }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: flex ? 1 : undefined,
        padding: small ? '4px 10px' : '6px 0',
        border: `1px solid ${disabled ? '#333' : color}`,
        background: disabled ? 'transparent' : hov ? `${color}40` : `${color}20`,
        color: disabled ? '#444' : color,
        borderRadius: 4, fontSize: small ? 10 : 11, fontWeight: 700,
        fontFamily: 'var(--mono)', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.12s', letterSpacing: '0.03em',
        width: flex ? undefined : small ? 'auto' : '100%',
      }}
    >{label}</button>
  )
}

function Stat({ label, value, color = '#ccc' }) {
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #242424', borderRadius: 3, padding: '4px 6px', minWidth: 0 }}>
      <div style={{ fontSize: 8, color: '#555', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 11, color, fontFamily: 'var(--mono)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

// ── Per-drone card ─────────────────────────────────────────────────────────────
function DroneCard({ drone, index, selected, primary, onClick, onCtxCmd }) {
  const tel     = drone.telemetry || {}
  const color   = DRONE_COLORS[index % DRONE_COLORS.length]
  const online  = drone.connected && drone.linkReady
  const batCol  = tel.battery_remaining < 0 ? '#666' : tel.battery_remaining < 20 ? '#f44336' : tel.battery_remaining < 40 ? '#ff9800' : '#4caf50'
  const gpsOk   = tel.gps_fix && tel.gps_fix !== 'NO_GPS' && tel.gps_fix !== 'NO_FIX'

  return (
    <div
      onClick={onClick}
      style={{
        borderLeft: `4px solid ${color}`,
        border: `1px solid ${selected ? color : drone.connected ? `${color}55` : '#2a2a2a'}`,
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderRadius: 5,
        padding: '8px 10px',
        background: selected ? `${color}18` : drone.connected ? `${color}0a` : '#181818',
        boxShadow: primary ? `0 0 0 1px ${color} inset` : 'none',
        cursor: 'pointer', userSelect: 'none', transition: 'background 0.12s',
        display: 'flex', flexDirection: 'column', gap: 7,
      }}
    >
      {/* Row 1: id + status badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${color}`, background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color, fontFamily: 'var(--mono)', fontWeight: 700,
        }}>D{drone.id}</div>
        <span style={{ fontSize: 12, color: '#ddd', fontWeight: 700 }}>Drone {drone.id}</span>
        {primary && <Pill label="PRI" color={color} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: online ? '#4caf50' : drone.connected ? '#ffd600' : '#f44336',
            boxShadow: online ? '0 0 5px #4caf50' : drone.connected ? '0 0 5px #ffd600' : 'none',
          }} />
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: online ? '#4caf50' : drone.connected ? '#ffd600' : '#555' }}>
            {online ? 'ONLINE' : drone.connected ? 'WAIT' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Row 2: mode / arm / gps pills */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Pill label={tel.armed ? 'ARMED' : 'DISARMED'} color={tel.armed ? '#ffd600' : '#f44336'} />
        <Pill label={tel.mode || 'UNKNOWN'} color="#00b4d8" />
        <Pill label={(!drone.connected || !drone.linkReady) ? 'NO_LINK' : (tel.gps_fix || 'NO_GPS')}
          color={gpsOk ? '#4caf50' : drone.connected && !drone.linkReady ? '#ffd600' : '#f44336'} />
      </div>

      {/* Row 3: 4-col stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        <Stat label="ALT"  value={`${(tel.altitude || 0).toFixed(1)}m`}  color="#d66bff" />
        <Stat label="GS"   value={`${(tel.groundspeed || 0).toFixed(1)}`} color="#ffa726" />
        <Stat label="BAT"  value={tel.battery_remaining >= 0 ? `${tel.battery_remaining}%` : '--'} color={batCol} />
        <Stat label="HDG"  value={`${(tel.heading || tel.hdg || 0).toFixed(0)}°`} color="#4dd0e1" />
      </div>

      {/* Row 4: lat/lon + per-card quick buttons */}
      {selected && (
        <div onClick={e => e.stopPropagation()}
          style={{ borderTop: '1px solid #2a2a2a', paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 9, color: '#444', fontFamily: 'var(--mono)' }}>
            {(tel.lat || 0).toFixed(6)}, {(tel.lon || 0).toFixed(6)}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Btn label="ARM"    color="#4caf50" small flex onClick={() => onCtxCmd(drone.id, 'arm')}    disabled={!online || tel.armed} />
            <Btn label="LAND"   color="#00b4d8" small flex onClick={() => onCtxCmd(drone.id, 'land')}   disabled={!online} />
            <Btn label="RTL"    color="#ff9800" small flex onClick={() => onCtxCmd(drone.id, 'rtl')}    disabled={!online} />
            <Btn label="DISARM" color="#f44336" small flex onClick={() => onCtxCmd(drone.id, 'disarm')} disabled={!online || !tel.armed} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main FleetPanel ────────────────────────────────────────────────────────────
export default function FleetPanel({
  drones = [],
  selectedDroneId,
  selectedDroneIds = [],
  targetPoint,
  targetMode,
  onSelectDrone,
  onToggleDroneSelect,
  onSelectAll,
  onClearSelection,
  onMakeTarget,        // () => void — activates map click for target
  onSendSelected,      // () => void — sends selected drones to targetPoint
  sendToDrone,         // (droneId, cmd) => void
}) {
  const [takeoffAlt, setTakeoffAlt] = useState(20)
  const [lastClicked, setLastClicked] = useState(null)

  const selectedSet     = new Set(selectedDroneIds)
  const totalCount      = drones.length
  const selCount        = selectedDroneIds.length
  const onlineCount     = drones.filter(d => d.connected && d.linkReady).length
  const selOnline       = drones.filter(d => selectedSet.has(d.id) && d.connected && d.linkReady)
  const selArmed        = selOnline.filter(d => d.telemetry?.armed)
  const selUnarmed      = selOnline.filter(d => !d.telemetry?.armed)
  const hasTarget       = targetPoint && typeof targetPoint.lat === 'number'

  // Batch actions
  const batchArm = () => {
    selUnarmed.forEach(d => sendToDrone(d.id, { type: 'command', command: 'arm' }))
  }
  const batchDisarm = () => {
    selArmed.forEach(d => sendToDrone(d.id, { type: 'command', command: 'disarm' }))
  }
  const batchTakeoff = () => {
    selArmed.forEach(d => sendToDrone(d.id, { type: 'command', command: 'takeoff', alt: takeoffAlt }))
  }
  const batchLand = () => {
    selOnline.forEach(d => sendToDrone(d.id, { type: 'command', command: 'land' }))
  }
  const batchRTL = () => {
    selOnline.forEach(d => sendToDrone(d.id, { type: 'command', command: 'rtl' }))
  }
  const ctxCmd = (droneId, command, extra = {}) => {
    sendToDrone(droneId, { type: 'command', command, ...extra })
  }

  // Click handler — plain click = sole select; ctrl = toggle; shift = range
  const handleCardClick = (e, droneId) => {
    const ids = drones.map(d => d.id)
    if (e.ctrlKey || e.metaKey) {
      onToggleDroneSelect(droneId)
      onSelectDrone(droneId)
      setLastClicked(droneId)
      return
    }
    if (e.shiftKey && lastClicked != null) {
      const a = ids.indexOf(lastClicked)
      const b = ids.indexOf(droneId)
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1)
      onClearSelection()
      range.forEach(id => onToggleDroneSelect(id))
      onSelectDrone(droneId)
      setLastClicked(droneId)
      return
    }
    // plain click — sole select or toggle if already sole
    if (selectedDroneIds.length === 1 && selectedDroneIds[0] === droneId) {
      // clicking already-sole-selected card: keep it selected (don't deselect)
    } else {
      onClearSelection()
      onToggleDroneSelect(droneId)
    }
    onSelectDrone(droneId)
    setLastClicked(droneId)
  }

  const makingTarget = targetMode === 'point'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'var(--mono)', overflow: 'hidden' }}>

      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #242424', background: '#0d0d0d',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 700, letterSpacing: 2 }}>FLEET</span>
        <span style={{ fontSize: 10, color: '#444' }}>
          {onlineCount}/{totalCount} ONLINE
        </span>
        <span style={{ fontSize: 10, color: '#00b4d8', marginLeft: 'auto' }}>
          {selCount > 0 ? `${selCount} SELECTED` : 'NONE SELECTED'}
        </span>
      </div>

      {/* ── Selection toolbar ──────────────────────────────────────────── */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #1e1e1e', background: '#111', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
          <Btn label="SELECT ALL" color="#00b4d8" small flex onClick={onSelectAll}      disabled={totalCount === 0} />
          <Btn label="CLEAR"      color="#666"    small flex onClick={onClearSelection} disabled={selCount === 0} />
        </div>
        <div style={{ display: 'flex', gap: 4, fontSize: 9, color: '#444', lineHeight: 1.7 }}>
          <span style={{ color: '#555' }}>Click=sole</span>
          <span style={{ color: '#333' }}>·</span>
          <span style={{ color: '#555' }}>Ctrl=toggle</span>
          <span style={{ color: '#333' }}>·</span>
          <span style={{ color: '#555' }}>Shift=range</span>
        </div>
      </div>

      {/* ── Batch command section ──────────────────────────────────────── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e1e1e', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* ARM / DISARM */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          <Btn label={`ARM (${selUnarmed.length})`}    color="#4caf50" onClick={batchArm}    disabled={selUnarmed.length === 0} />
          <Btn label={`DISARM (${selArmed.length})`}   color="#f44336" onClick={batchDisarm} disabled={selArmed.length === 0} />
        </div>

        {/* TAKEOFF */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#111', border: '1px solid #2a2a2a', borderRadius: 4, padding: '0 6px' }}>
            <input
              type="number" min={1} max={200} value={takeoffAlt}
              onChange={e => setTakeoffAlt(Math.max(1, +e.target.value))}
              style={{ width: 42, background: 'transparent', border: 'none', outline: 'none',
                color: '#ffd600', fontSize: 12, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700 }}
            />
            <span style={{ fontSize: 9, color: '#444' }}>m</span>
          </div>
          <div style={{ flex: 1 }}>
            <Btn label={`TAKEOFF (${selArmed.length})`} color="#ffd600" onClick={batchTakeoff} disabled={selArmed.length === 0} />
          </div>
        </div>

        {/* LAND / RTL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          <Btn label={`LAND (${selOnline.length})`} color="#00b4d8" onClick={batchLand} disabled={selOnline.length === 0} />
          <Btn label={`RTL (${selOnline.length})`}  color="#ff9800" onClick={batchRTL}  disabled={selOnline.length === 0} />
        </div>
      </div>

      {/* ── Target section ─────────────────────────────────────────────── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e1e1e', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
          Target Mission
        </div>

        {/* Make target */}
        <div
          onClick={onMakeTarget}
          style={{
            padding: '7px 10px', borderRadius: 4, cursor: 'pointer', textAlign: 'center',
            border: `1px solid ${makingTarget ? '#ffd600' : '#333'}`,
            background: makingTarget ? '#ffd60018' : '#0d0d0d',
            color: makingTarget ? '#ffd600' : '#666',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: makingTarget ? '#ffd600' : '#333',
            boxShadow: makingTarget ? '0 0 6px #ffd600' : 'none',
            animation: makingTarget ? 'pulse 1s infinite' : 'none',
            flexShrink: 0,
          }} />
          {makingTarget ? 'CLICK MAP TO SET TARGET...' : 'MAKE TARGET (Click Map)'}
        </div>

        {/* Target coords */}
        {hasTarget && (
          <div style={{ background: '#0a0a0a', border: '1px solid #ffd60033', borderRadius: 4, padding: '5px 8px',
            fontSize: 10, color: '#ffd600', fontFamily: 'var(--mono)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>TARGET</span>
            <span>{targetPoint.lat.toFixed(6)},  {targetPoint.lng.toFixed(6)}</span>
          </div>
        )}

        {/* Send selected */}
        <div
          onClick={hasTarget && selOnline.length > 0 ? onSendSelected : undefined}
          style={{
            padding: '8px 10px', borderRadius: 4,
            border: `1px solid ${hasTarget && selOnline.length > 0 ? '#4caf50' : '#2a2a2a'}`,
            background: hasTarget && selOnline.length > 0 ? '#4caf5018' : '#0a0a0a',
            color: hasTarget && selOnline.length > 0 ? '#4caf50' : '#333',
            cursor: hasTarget && selOnline.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: 11, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (hasTarget && selOnline.length > 0) e.currentTarget.style.background = '#4caf5030' }}
          onMouseLeave={e => { if (hasTarget && selOnline.length > 0) e.currentTarget.style.background = '#4caf5018' }}
        >
          {hasTarget && selOnline.length > 0
            ? `SEND ${selOnline.length} DRONE${selOnline.length > 1 ? 'S' : ''} TO TARGET`
            : !hasTarget ? 'MAKE TARGET FIRST' : 'SELECT ONLINE DRONES FIRST'}
        </div>
      </div>

      {/* ── Drone card list ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {drones.length === 0 ? (
          <div style={{ color: '#333', textAlign: 'center', padding: 24, fontSize: 11 }}>
            No drone slots.<br />
            <span style={{ color: '#222' }}>Add drones via the connection bar.</span>
          </div>
        ) : (
          drones.map((drone, i) => (
            <DroneCard
              key={drone.id}
              drone={drone}
              index={i}
              selected={selectedSet.has(drone.id)}
              primary={selectedDroneId === drone.id}
              onClick={e => handleCardClick(e, drone.id)}
              onCtxCmd={ctxCmd}
            />
          ))
        )}
      </div>

      {/* ── Emergency footer ──────────────────────────────────────────── */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid #1e1e1e', background: '#090909', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#333', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Emergency — All Connected
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          <Btn label="LAND ALL"  color="#00b4d8" onClick={() => drones.filter(d => d.connected && d.linkReady).forEach(d => sendToDrone(d.id, { type: 'command', command: 'land' }))} disabled={onlineCount === 0} />
          <Btn label="RTL ALL"   color="#ff9800" onClick={() => drones.filter(d => d.connected && d.linkReady).forEach(d => sendToDrone(d.id, { type: 'command', command: 'rtl' }))}  disabled={onlineCount === 0} />
        </div>
      </div>
    </div>
  )
}