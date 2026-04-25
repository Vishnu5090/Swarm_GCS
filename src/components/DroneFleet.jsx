import React, { useState } from 'react'

const DRONE_COLORS = ['#ff5a36','#00e5ff','#69ff47','#ff1744','#ffd600','#d500f9','#ff6d00','#00e676']
const MODES = ['STABILIZE','ACRO','ALT_HOLD','AUTO','GUIDED','LOITER','RTL','CIRCLE','LAND','POSHOLD','BRAKE','SMART_RTL']

function DroneCard({ drone, index, selected, onSelect, onSendTo, onCommand }) {
  const tel = drone.telemetry || {}
  const color = DRONE_COLORS[index % DRONE_COLORS.length]
  const [destLat, setDestLat] = useState('')
  const [destLon, setDestLon] = useState('')
  const [destAlt, setDestAlt] = useState('20')

  return (
    <div
      onClick={() => onSelect(drone.id)}
      style={{
        borderTop: `1px solid ${selected ? color : '#3a3a3a'}`,
        borderRight: `1px solid ${selected ? color : '#3a3a3a'}`,
        borderBottom: `1px solid ${selected ? color : '#3a3a3a'}`,
        borderRadius: 4, padding: 8, marginBottom: 6,
        background: selected ? color + '12' : '#1c1c1c',
        cursor: 'pointer', transition: 'all 0.15s',
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: color + '33', border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: 'var(--mono)', color, fontWeight: 700
        }}>
          D{drone.id}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>Drone {drone.id}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: drone.connected ? '#4caf50' : '#f44336',
            boxShadow: drone.connected ? '0 0 5px #4caf50' : 'none'
          }} />
          <span style={{ fontSize: 9, color: drone.connected ? '#4caf50' : '#f44336', fontFamily: 'var(--mono)' }}>
            {drone.connected ? 'CONN' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Telemetry mini */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
        {[
          ['ALT', (tel.altitude||0).toFixed(1), 'm'],
          ['GS', (tel.groundspeed||0).toFixed(1), 'm/s'],
          ['BAT', tel.battery_remaining >= 0 ? tel.battery_remaining + '%' : '--', ''],
        ].map(([l, v, u]) => (
          <div key={l} style={{ background: '#111', borderRadius: 3, padding: '3px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: '#555', fontFamily: 'var(--mono)' }}>{l}</div>
            <div style={{ fontSize: 11, color: '#ccc', fontFamily: 'var(--mono)', fontWeight: 700 }}>{v}<span style={{ fontSize: 8, color: '#555' }}>{u}</span></div>
          </div>
        ))}
      </div>

      {/* Mode & arm */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center' }}>
        <span style={{
          fontSize: 9, padding: '2px 6px', borderRadius: 2,
          background: tel.armed ? '#ffd60022' : '#f4433622',
          border: `1px solid ${tel.armed ? '#ffd600' : '#f44336'}`,
          color: tel.armed ? '#ffd600' : '#f44336',
          fontFamily: 'var(--mono)', fontWeight: 700
        }}>
          {tel.armed ? 'ARMED' : 'DISARM'}
        </span>
        <span style={{
          fontSize: 9, padding: '2px 6px', borderRadius: 2,
          background: '#00b4d822', border: '1px solid #00b4d8',
          color: '#00b4d8', fontFamily: 'var(--mono)'
        }}>
          {tel.mode || 'UNKNOWN'}
        </span>
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
          {(tel.lat||0).toFixed(4)}, {(tel.lon||0).toFixed(4)}
        </span>
      </div>

      {/* Custom destination */}
      {selected && (
        <div style={{ borderTop: '1px solid #333', paddingTop: 8 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 9, color: '#888', marginBottom: 4, fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
            SET DESTINATION
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              value={destLat} onChange={e => setDestLat(e.target.value)}
              placeholder="Latitude"
              style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 3, fontSize: 10, fontFamily: 'var(--mono)' }}
            />
            <input
              value={destLon} onChange={e => setDestLon(e.target.value)}
              placeholder="Longitude"
              style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 3, fontSize: 10, fontFamily: 'var(--mono)' }}
            />
            <input
              value={destAlt} onChange={e => setDestAlt(e.target.value)}
              placeholder="Alt"
              style={{ width: 40, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 3, fontSize: 10, fontFamily: 'var(--mono)', textAlign: 'center' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => {
                const lat = parseFloat(destLat), lon = parseFloat(destLon), alt = parseFloat(destAlt) || 20
                if (!isNaN(lat) && !isNaN(lon)) onSendTo(drone.id, lat, lon, alt)
              }}
              style={{
                flex: 1, padding: '4px 0', background: color + '22', border: `1px solid ${color}`,
                color, borderRadius: 3, fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer', fontWeight: 700
              }}
            >
              ▶ GO TO
            </button>
            <button
              onClick={() => onCommand(drone.id, 'rtl')}
              style={{
                padding: '4px 8px', background: '#ff980022', border: '1px solid #ff9800',
                color: '#ff9800', borderRadius: 3, fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer'
              }}
            >
              RTL
            </button>
            <button
              onClick={() => onCommand(drone.id, 'land')}
              style={{
                padding: '4px 8px', background: '#00b4d822', border: '1px solid #00b4d8',
                color: '#00b4d8', borderRadius: 3, fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer'
              }}
            >
              LAND
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DroneFleet({ drones, onSendTo, onCommand, onAddDrone, targetPoint }) {
  const [selectedDrone, setSelectedDrone] = useState(null)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#888', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          SWARM ({drones.length})
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {targetPoint && (
            <div style={{ fontSize: 9, color: '#ffd600', fontFamily: 'var(--mono)', padding: '2px 6px', border: '1px solid #ffd60055', borderRadius: 3 }}>
              TGT: {targetPoint.lat.toFixed(4)}, {targetPoint.lng.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Collision avoidance notice */}
      <div style={{
        fontSize: 9, color: '#4caf50', fontFamily: 'var(--mono)',
        background: '#4caf5012', border: '1px solid #4caf5033',
        borderRadius: 3, padding: '3px 6px', marginBottom: 8,
        display: 'flex', gap: 4, alignItems: 'center'
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4caf50' }} />
        COLLISION AVOIDANCE ACTIVE • MIN SEP: 8m
      </div>

      {/* Drone list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {drones.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 20, fontSize: 11, fontFamily: 'var(--mono)' }}>
            No drones connected.<br/>Add ports to connect.
          </div>
        ) : (
          drones.map((drone, i) => (
            <DroneCard
              key={drone.id}
              drone={drone}
              index={i}
              selected={selectedDrone === drone.id}
              onSelect={(id) => setSelectedDrone(selectedDrone === id ? null : id)}
              onSendTo={onSendTo}
              onCommand={onCommand}
            />
          ))
        )}
      </div>

      {/* Add drone button */}
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onAddDrone}
          style={{
            width: '100%', padding: '6px 0',
            background: 'transparent', border: '1px dashed #444',
            color: '#666', borderRadius: 3, cursor: 'pointer',
            fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '0.04em',
            transition: 'all 0.15s'
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#666' }}
        >
          + ADD DRONE
        </button>
      </div>
    </div>
  )
}
