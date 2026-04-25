import React, { useState, useEffect } from 'react'

const COMMON_TCP_PORTS = [5760, 5762, 5764, 5766, 5768]
const COMMON_UDP_PORTS = [14680, 14690, 14700, 14670, 14550]

function DroneConnection({ drone, drones, selected, onSelect, onConnect, onDisconnect, onRemove }) {
  const [proto, setProto] = useState(drone.connectionConfig?.proto || 'UDP')
  const [host, setHost] = useState(drone.connectionConfig?.host || '127.0.0.1')
  const [port, setPort] = useState(drone.connectionConfig?.port || drone.defaultPort || 14680)
  const [autoDetecting, setAutoDetecting] = useState(false)
  const color = ['#ff5a36', '#00e5ff', '#69ff47', '#ff1744', '#ffd600', '#d500f9', '#ff6d00', '#00e676'][(drone.id - 1) % 8]

  useEffect(() => {
    if (!drone.connected && drone.connectionConfig) {
      setProto(drone.connectionConfig.proto || 'UDP')
      setHost(drone.connectionConfig.host || '127.0.0.1')
      setPort(drone.connectionConfig.port || drone.defaultPort || 14680)
    }
  }, [drone.connected, drone.connectionConfig, drone.defaultPort])

  const autoDetect = async () => {
    setAutoDetecting(true)
    const candidatePorts = proto === 'UDP' ? COMMON_UDP_PORTS : COMMON_TCP_PORTS
    const usedPorts = new Set(
      drones
        .filter(d => d.id !== drone.id)
        .map(d => d.connected ? d.connInfo?.port : d.connectionConfig?.port)
        .filter(Boolean)
    )
    const nextPort = candidatePorts.find(p => !usedPorts.has(p))
      || (proto === 'UDP' ? COMMON_UDP_PORTS[0] : drone.defaultPort || COMMON_TCP_PORTS[0])
    setPort(nextPort)
    await new Promise(resolve => setTimeout(resolve, 180))
    setAutoDetecting(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 3,
        background: selected ? `${color}20` : drone.connected ? `${color}12` : '#1a1a1a',
        border: `1px solid ${selected ? color : drone.connected ? color : '#333'}`,
        boxShadow: selected ? `0 0 0 1px ${color}55 inset` : 'none',
        flexShrink: 0,
        cursor: 'pointer',
      }}
      onClick={() => onSelect?.(drone.id)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: drone.connected ? (drone.linkReady ? color : '#ffd600') : '#555',
            boxShadow: drone.connected ? `0 0 6px ${drone.linkReady ? color : '#ffd600'}` : 'none',
          }}
        />
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color, fontWeight: 700, minWidth: 20 }}>
          D{drone.id}
        </span>
      </div>

      {!drone.connected ? (
        <>
          <select
            value={proto}
            onChange={e => setProto(e.target.value)}
            style={{ padding: '1px 4px', background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 2, fontSize: 10, height: 22 }}
          >
            <option>TCP</option>
            <option>UDP</option>
          </select>
          {proto === 'TCP' && (
            <input
              value={host}
              onChange={e => setHost(e.target.value)}
              style={{ width: 90, padding: '1px 4px', background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 2, fontSize: 10, height: 22, fontFamily: 'var(--mono)' }}
            />
          )}
          <select
            value={port}
            onChange={e => setPort(+e.target.value)}
            style={{ width: 65, padding: '1px 4px', background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 2, fontSize: 10, height: 22, fontFamily: 'var(--mono)' }}
          >
            {(proto === 'UDP' ? COMMON_UDP_PORTS : COMMON_TCP_PORTS).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={autoDetect}
            disabled={autoDetecting}
            title={`Auto-fill a likely ${proto} port`}
            style={{
              padding: '1px 6px',
              background: '#222',
              border: '1px solid #555',
              color: autoDetecting ? '#ffd600' : '#888',
              borderRadius: 2,
              fontSize: 9,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              height: 22,
              animation: autoDetecting ? 'pulse 0.5s infinite' : 'none',
            }}
          >
            {autoDetecting ? '...' : 'AUTO'}
          </button>
          <button
            onClick={() => onConnect(drone.id, { proto, host, port: +port })}
            style={{
              padding: '1px 8px',
              background: '#4caf5022',
              border: '1px solid #4caf50',
              color: '#4caf50',
              borderRadius: 2,
              fontSize: 10,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              fontWeight: 700,
              height: 22,
            }}
          >
            CONNECT
          </button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#777' }}>
            {drone.connInfo?.proto} {drone.connInfo?.host ? `${drone.connInfo.host}:` : ''}{drone.connInfo?.port}
          </span>
          {!drone.linkReady && (
            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#ffd600' }}>
              WAIT
            </span>
          )}
          <button
            onClick={() => onDisconnect(drone.id)}
            style={{
              padding: '1px 8px',
              background: '#f4433622',
              border: '1px solid #f44336',
              color: '#f44336',
              borderRadius: 2,
              fontSize: 10,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              height: 22,
            }}
          >
            DISC
          </button>
        </>
      )}

      <button
        onClick={() => onRemove(drone.id)}
        title="Remove drone slot"
        style={{
          padding: '1px 5px',
          background: 'transparent',
          border: '1px solid #333',
          color: '#555',
          borderRadius: 2,
          fontSize: 10,
          cursor: 'pointer',
          height: 22,
        }}
        onMouseOver={e => { e.currentTarget.style.color = '#f44336'; e.currentTarget.style.borderColor = '#f44336' }}
        onMouseOut={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#333' }}
      >
        X
      </button>
    </div>
  )
}

export default function MultiConnectionBar({
  drones,
  selectedDroneId,
  selectedDroneIds = [],
  onSelectDrone,
  onConnect,
  onDisconnect,
  onAddDrone,
  onRemoveDrone,
  targetMode,
  onSetTargetMode,
  onSendAllToTarget,
  onStartScan,
}) {
  const selectedDrone = drones.find(drone => drone.id === selectedDroneId)
  const selectedLabel = selectedDrone ? `D${selectedDrone.id}` : 'selected drone'
  const selectedCount = selectedDroneIds.length

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        background: '#0d0d0d',
        borderBottom: '2px solid var(--border)',
        flexShrink: 0,
        overflowX: 'auto',
        minHeight: 46,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: drones.some(d => d.connected && d.linkReady) ? '#4caf50' : drones.some(d => d.connected) ? '#ffd600' : '#555',
            boxShadow: drones.some(d => d.connected && d.linkReady) ? '0 0 6px #4caf50' : 'none',
          }}
        />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: 2 }}>
          SWARM GCS
        </span>
      </div>

      <div style={{ width: 1, height: 28, background: '#333', flexShrink: 0 }} />

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {drones.map(drone => (
          <DroneConnection
            key={drone.id}
            drone={drone}
            drones={drones}
            selected={selectedDroneId === drone.id}
            onSelect={onSelectDrone}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onRemove={onRemoveDrone}
          />
        ))}
        <button
          onClick={onAddDrone}
          title="Add drone"
          style={{
            height: 28,
            padding: '0 10px',
            background: 'transparent',
            border: '1px dashed #444',
            color: '#666',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'var(--mono)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#666' }}
        >
          + DRONE
        </button>
      </div>

      <div style={{ width: 1, height: 28, background: '#333', flexShrink: 0 }} />

      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => onSetTargetMode(targetMode === 'point' ? null : 'point')}
          title={`Click map to set a target for ${selectedLabel}`}
          style={{
            height: 28,
            padding: '0 10px',
            background: targetMode === 'point' ? '#ffd60033' : 'transparent',
            border: `1px solid ${targetMode === 'point' ? '#ffd600' : '#444'}`,
            color: targetMode === 'point' ? '#ffd600' : '#888',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            animation: targetMode === 'point' ? 'blink 1s infinite' : 'none',
          }}
        >
          MARK TARGET
        </button>
        <button
          onClick={onSendAllToTarget}
          title={`Send ${selectedCount || 0} selected drones to the marked target`}
          style={{
            height: 28,
            padding: '0 10px',
            background: '#ff5a3622',
            border: '1px solid #ff5a36',
            color: '#ff5a36',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#ff5a3644' }}
          onMouseOut={e => { e.currentTarget.style.background = '#ff5a3622' }}
        >
          SEND SELECTED{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
        <button
          onClick={() => onSetTargetMode(targetMode === 'scan' ? null : 'scan')}
          title={`Mark a scan area for ${selectedLabel}`}
          style={{
            height: 28,
            padding: '0 10px',
            background: targetMode === 'scan' ? '#ffd60033' : 'transparent',
            border: `1px solid ${targetMode === 'scan' ? '#ffd600' : '#444'}`,
            color: targetMode === 'scan' ? '#ffd600' : '#888',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
          }}
        >
          SCAN AREA
        </button>
        <button
          onClick={onStartScan}
          title={`Start scan for ${selectedCount > 0 ? `${selectedCount} selected drones` : selectedLabel}`}
          style={{
            height: 28,
            padding: '0 10px',
            background: '#4caf5022',
            border: '1px solid #4caf50',
            color: '#4caf50',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#4caf5044' }}
          onMouseOut={e => { e.currentTarget.style.background = '#4caf5022' }}
        >
          START SCAN
        </button>
      </div>
    </div>
  )
}
