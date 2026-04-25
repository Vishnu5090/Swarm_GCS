import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import SideMenu from './components/SideMenu'
import MultiConnectionBar from './components/MultiConnectionBar'
import StatusBar from './components/StatusBar'
import DraggablePanel from './components/DraggablePanel'
import HUD from './components/HUD'
import MapView from './components/MapView'
import TelemetryPanel from './components/TelemetryPanel'
import ActionsPanel from './components/ActionsPanel'
import MessagesPanel from './components/MessagesPanel'
import SwarmPanel from './components/SwarmPanel'
import DroneOverviewPanel from './components/DroneOverviewPanel'

const INITIAL_TEL = {
  roll:0, pitch:0, yaw:0, heading:0, airspeed:0, groundspeed:0,
  altitude:0, climb:0, throttle:0, armed:false, mode:'STABILIZE',
  lat:0, lon:0, hdg:0, wp_dist:0, dist_to_mav:0,
  voltage_battery:0, current_battery:0, battery_remaining:-1,
  gps_fix:'NO_GPS', satellites:0, hdop:99
}

const DRONE_STORAGE_KEY = 'ardupilot-gcs-drones'
const DEFAULT_UDP_PORTS = [14680, 14690, 14700, 14670, 14550]

let nextDroneId = 1

function getDefaultDroneConfig(id) {
  const port = DEFAULT_UDP_PORTS[id - 1] || (DEFAULT_UDP_PORTS[DEFAULT_UDP_PORTS.length - 1] + (id - DEFAULT_UDP_PORTS.length) * 10)
  return { proto: 'UDP', host: '127.0.0.1', port }
}

function createDrone(id, defaultPort, defaultProto = 'UDP') {
  const defaultConfig = defaultProto === 'UDP'
    ? { proto: 'UDP', host: '127.0.0.1', port: defaultPort }
    : { proto: 'TCP', host: '127.0.0.1', port: defaultPort }
  return {
    id,
    connected: false,
    connInfo: null,
    defaultPort,
    connectionConfig: defaultConfig,
    autoReconnect: false,
    linkReady: false,
    telemetry: { ...INITIAL_TEL },
    messages: [],
    ws: null,
  }
}

// Collision avoidance: compute formation positions around target
function computeFormationPositions(drones, targetLat, targetLng) {
  const n = drones.length
  if (n === 0) return []
  const SAFE_DIST = 0.00009 // ~10m
  return drones.map((drone, i) => {
    if (n === 1) return { lat: targetLat, lng: targetLng }
    const angle = (2 * Math.PI * i) / n
    const rings = Math.ceil(i / 6)
    const radius = SAFE_DIST * (1 + rings * 0.5)
    return {
      lat: targetLat + Math.cos(angle) * radius,
      lng: targetLng + Math.sin(angle) * radius,
    }
  })
}

function isDuplicateConnection(drones, droneId, connParams) {
  return drones.some((drone) => {
    if (drone.id === droneId || !drone.connected || !drone.connInfo) return false
    if (connParams.proto === 'UDP') {
      return drone.connInfo.proto === 'UDP' && Number(drone.connInfo.port) === Number(connParams.port)
    }
    return (
      drone.connInfo.proto === 'TCP' &&
      drone.connInfo.host === connParams.host &&
      Number(drone.connInfo.port) === Number(connParams.port)
    )
  })
}

export default function App() {
  const CANVAS_PAD_X = 6
  const CANVAS_PAD_TOP = 8
  const PANEL_GAP = 4
  const LEFT_W = 420
  const RIGHT_W = 220
  const TOP_MARGIN = 55
  const TOP_H = 266
  const BOTTOM_H = 316
  const LOG_H = 152
  const LEFT_X = 0
  const CENTER_X = LEFT_X + LEFT_W + PANEL_GAP
  const TOP_Y = TOP_MARGIN

  const reconnectingIds = useRef(new Set())
  const [drones, setDrones] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRONE_STORAGE_KEY) || 'null')
      if (Array.isArray(saved) && saved.length > 0) {
        const hydrated = saved.map((raw) => {
          const id = Number(raw?.id) || nextDroneId++
          const fallbackConfig = getDefaultDroneConfig(id)
          const defaultPort = Number(raw?.defaultPort) || fallbackConfig.port
          const savedProto = raw?.connectionConfig?.proto === 'TCP' ? 'TCP' : 'UDP'
          return {
            ...createDrone(id, defaultPort, savedProto),
            connectionConfig: {
              proto: savedProto,
              host: raw?.connectionConfig?.host || '127.0.0.1',
              port: Number(raw?.connectionConfig?.port) || defaultPort,
            },
            autoReconnect: Boolean(raw?.autoReconnect),
          }
        })
        nextDroneId = Math.max(...hydrated.map(d => d.id), 0) + 1
        return hydrated
      }
    } catch {}
    const initial = getDefaultDroneConfig(nextDroneId)
    return [createDrone(nextDroneId++, initial.port, initial.proto)]
  })
  const [messages, setMessages] = useState([])
  const [selectedDroneId, setSelectedDroneId] = useState(1)
  const [selectedDroneIds, setSelectedDroneIds] = useState([])
  const [activeTab, setActiveTab] = useState('quick')
  const [targetMode, setTargetMode] = useState(null)
  const [targetPoint, setTargetPoint] = useState(null)
  const [scanArea, setScanArea] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [swarmData, setSwarmData] = useState({
    drones: [],
    swarm_mode: 'idle',
    search_progress: 0,
    formation: 'wedge',
    drone_count: 0,
  })
  const wsRefs = useRef({})
  const selectedTargetRef = useRef(null)

  const [visiblePanels, setVisiblePanels] = useState({
    hud: true, map: true, tel: true, msg: true, drones: false, fleet: true
  })

  const [zOrders, setZOrders] = useState({ hud:10, map:9, tel:8, msg:6, drones:11, fleet:7 })
  const leftPanelVisible = visiblePanels.hud || visiblePanels.tel
  const rightPanelVisible = visiblePanels.drones || visiblePanels.fleet
  const mapX = leftPanelVisible ? CENTER_X : LEFT_X
  const mapWidth = (rightPanelVisible ? 656 : 880) + (leftPanelVisible ? 0 : LEFT_W + PANEL_GAP)
  const mapHeight = visiblePanels.msg ? 430 : 586
  const rightX = mapX + mapWidth + PANEL_GAP
  const bottomY = TOP_Y + TOP_H + PANEL_GAP
  const logY = TOP_Y + mapHeight + PANEL_GAP

  const bringToFront = useCallback(id => {
    setZOrders(prev => {
      const max = Math.max(...Object.values(prev))
      if (prev[id] === max) return prev
      return { ...prev, [id]: max + 1 }
    })
  }, [])

  const togglePanel = useCallback((id) => {
    setVisiblePanels(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handlePanelClose = useCallback((id) => {
    setVisiblePanels(prev => ({ ...prev, [id]: false }))
  }, [])

  const resetLayout = useCallback(() => {
    setVisiblePanels({ hud: true, map: true, tel: true, msg: true, drones: false, fleet: true })
    setResetKey(k => k + 1)
  }, [])

  useEffect(() => {
    if (!drones.some(d => d.id === selectedDroneId)) {
      setSelectedDroneId(drones[0]?.id ?? 1)
    }
  }, [drones, selectedDroneId])

  useEffect(() => {
    setSelectedDroneIds(prev => {
      const valid = prev.filter(id => drones.some(drone => drone.id === id))
      if (valid.length > 0) return valid
      if (drones.some(drone => drone.id === selectedDroneId)) return [selectedDroneId]
      return drones[0] ? [drones[0].id] : []
    })
  }, [drones, selectedDroneId])

  useEffect(() => {
    const persisted = drones.map(drone => ({
      id: drone.id,
      defaultPort: drone.defaultPort,
      connectionConfig: drone.connectionConfig,
      autoReconnect: drone.autoReconnect,
    }))
    localStorage.setItem(DRONE_STORAGE_KEY, JSON.stringify(persisted))
  }, [drones])

  // WebSocket for a drone
  const connectDroneWS = useCallback((droneId, { proto, host, port }) => {
    const wsUrl = 'ws://localhost:8765/ws'
    if (wsRefs.current[droneId]) {
      try { wsRefs.current[droneId].close() } catch {}
    }

    const ws = new WebSocket(wsUrl)
    wsRefs.current[droneId] = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'connect', droneId, proto, host, port }))
    }

    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data)
        if (ev.droneId !== undefined && ev.droneId !== droneId) return

        if (ev.ev === 'status') {
          setDrones(prev => prev.map(d => d.id === droneId ? {
            ...d,
            connected: ev.connected,
            linkReady: Boolean(ev.linkReady),
            connInfo: ev.connected ? { proto: ev.proto, host: ev.host, port: ev.port } : null,
            connectionConfig: ev.connected ? {
              proto: ev.proto || proto,
              host: ev.host || host || '127.0.0.1',
              port: ev.port || port,
            } : d.connectionConfig,
          } : d))
          if (ev.connected) reconnectingIds.current.delete(droneId)
        } else if (ev.ev === 'mav') {
          const msg = ev.msg
          setDrones(prev => prev.map(d => {
            if (d.id !== droneId) return d
            let tel = d.telemetry
            switch (msg.type) {
              case 'HEARTBEAT': tel = { ...tel, armed: msg.armed, mode: msg.mode }; break
              case 'ATTITUDE': tel = { ...tel, roll: msg.roll, pitch: msg.pitch, yaw: msg.yaw }; break
              case 'VFR_HUD': tel = { ...tel, airspeed: msg.airspeed, groundspeed: msg.groundspeed, altitude: msg.alt, climb: msg.climb, throttle: msg.throttle, heading: msg.heading }; break
              case 'GLOBAL_POSITION_INT': tel = { ...tel, lat: msg.lat, lon: msg.lon, hdg: msg.hdg, altitude: msg.relative_alt > 0 ? msg.relative_alt : tel.altitude }; break
              case 'NAV_CONTROLLER_OUTPUT': tel = { ...tel, wp_dist: msg.wp_dist }; break
              case 'SYS_STATUS': tel = { ...tel, voltage_battery: msg.voltage_battery, current_battery: msg.current_battery, battery_remaining: msg.battery_remaining }; break
              case 'GPS_RAW_INT': tel = { ...tel, gps_fix: msg.fix_str, satellites: msg.satellites_visible, hdop: msg.hdop }; break
              default: break
            }
            if (msg.type === 'STATUSTEXT') {
              const time = new Date().toLocaleTimeString()
              setMessages(prev => [...prev.slice(-499), { ...msg, time, droneId }])
              return { ...d, telemetry: tel, messages: [...(d.messages||[]).slice(-99), { ...msg, time }] }
            }
            return { ...d, telemetry: tel }
          }))
        } else if (ev.ev === 'error') {
          const time = new Date().toLocaleTimeString()
          setMessages(prev => [...prev.slice(-499), { severity_str:'ERROR', text: ev.msg, time, droneId }])
        }
      } catch {}
    }

    ws.onclose = () => {
      delete wsRefs.current[droneId]
      reconnectingIds.current.delete(droneId)
      setDrones(prev => prev.map(d => d.id === droneId ? { ...d, connected: false, linkReady: false } : d))
    }
  }, [])

  const handleConnect = useCallback((droneId, connParams) => {
    if (isDuplicateConnection(drones, droneId, connParams)) {
      const time = new Date().toLocaleTimeString()
      const endpoint = connParams.proto === 'UDP'
        ? `UDP ${connParams.port}`
        : `TCP ${connParams.host}:${connParams.port}`
      setMessages(prev => [...prev.slice(-499), {
        severity_str: 'ERROR',
        text: `Connection already in use by another drone slot: ${endpoint}`,
        time,
        droneId,
      }])
      return
    }
    setDrones(prev => prev.map(d => d.id === droneId ? {
      ...d,
      connectionConfig: { proto: connParams.proto, host: connParams.host || '127.0.0.1', port: Number(connParams.port) },
      autoReconnect: true,
    } : d))
    reconnectingIds.current.add(droneId)
    connectDroneWS(droneId, connParams)
  }, [connectDroneWS, drones])

  const handleDisconnect = useCallback((droneId) => {
    const ws = wsRefs.current[droneId]
    if (ws) {
      ws.send(JSON.stringify({ type: 'disconnect', droneId }))
    }
    reconnectingIds.current.delete(droneId)
    setDrones(prev => prev.map(d => d.id === droneId ? { ...d, connected: false, linkReady: false, connInfo: null, autoReconnect: false } : d))
  }, [])

  const handleAddDrone = useCallback(() => {
    const id = nextDroneId++
    const defaultConfig = getDefaultDroneConfig(id)
    setDrones(prev => [...prev, createDrone(id, defaultConfig.port, defaultConfig.proto)])
  }, [])

  const handleRemoveDrone = useCallback((droneId) => {
    if (wsRefs.current[droneId]) {
      try { wsRefs.current[droneId].close() } catch {}
      delete wsRefs.current[droneId]
    }
    reconnectingIds.current.delete(droneId)
    setDrones(prev => prev.filter(d => d.id !== droneId))
  }, [])

  // Send command to specific drone
  const sendToDrone = useCallback((droneId, cmd) => {
    const ws = wsRefs.current[droneId]
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...cmd, droneId }))
    }
  }, [])

  const sendToMultipleDrones = useCallback((droneIds, cmd) => {
    droneIds.forEach((droneId) => sendToDrone(droneId, cmd))
  }, [sendToDrone])

  const sendSelectedToTarget = useCallback(() => {
    if (!targetPoint || selectedDroneIds.length === 0) return
    sendToMultipleDrones(selectedDroneIds, {
      type: 'command',
      command: 'goto',
      lat: targetPoint.lat,
      lon: targetPoint.lng,
      alt: 20,
    })
  }, [selectedDroneIds, sendToMultipleDrones, targetPoint])

  const setPrimaryDrone = useCallback((droneId) => {
    setSelectedDroneId(droneId)
    setSelectedDroneIds(prev => (prev.includes(droneId) ? prev : [...prev, droneId]))
  }, [])

  const toggleDroneSelection = useCallback((droneId) => {
    setSelectedDroneIds(prev => (
      prev.includes(droneId)
        ? prev.filter(id => id !== droneId)
        : [...prev, droneId]
    ))
  }, [])

  const selectAllDrones = useCallback(() => {
    setSelectedDroneIds(drones.map(drone => drone.id))
  }, [drones])

  const clearSelectedDrones = useCallback(() => {
    setSelectedDroneIds([])
  }, [])

  const handleBatchTakeoff = useCallback((altitude) => {
    const eligibleIds = drones
      .filter(drone => selectedDroneIds.includes(drone.id) && drone.connected && drone.linkReady && drone.telemetry?.armed)
      .map(drone => drone.id)

    if (!eligibleIds.length) return 0

    sendToMultipleDrones(eligibleIds, {
      type: 'command',
      command: 'takeoff',
      alt: altitude,
    })

    return eligibleIds.length
  }, [drones, selectedDroneIds, sendToMultipleDrones])

  const handleSwarmMessage = useCallback((ev) => {
    if (ev.ev === 'swarm_positions') {
      setSwarmData({
        drones: ev.drones || [],
        swarm_mode: ev.swarm_mode || 'idle',
        search_progress: ev.search_progress || 0,
        formation: ev.formation || 'wedge',
        drone_count: ev.drone_count || 0,
      })
    } else if (ev.ev === 'swarm') {
      setSwarmData(prev => ({ ...prev, ...(ev.data || {}) }))
    } else if (ev.ev === 'error') {
      const time = new Date().toLocaleTimeString()
      setMessages(prev => [...prev.slice(-499), { severity_str:'ERROR', text: ev.msg, time }])
    }
  }, [])

  const sendSwarm = useWebSocket('ws://localhost:8765/ws', handleSwarmMessage)

  // The primary drone for HUD/telemetry
  const primaryDrone = drones[0] || { id: 1, telemetry: INITIAL_TEL, messages: [], connected: false, linkReady: false }
  const selectedDrone = drones.find(d => d.id === selectedDroneId) || primaryDrone
  const selectedSend = useCallback((cmd) => sendToDrone(selectedDrone.id, cmd), [selectedDrone.id, sendToDrone])

  // Legacy send for old components
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(n=>n+1), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    drones.forEach((drone) => {
      if (!drone.autoReconnect || drone.connected || wsRefs.current[drone.id] || reconnectingIds.current.has(drone.id)) return
      reconnectingIds.current.add(drone.id)
      connectDroneWS(drone.id, drone.connectionConfig || { proto: 'TCP', host: '127.0.0.1', port: drone.defaultPort })
    })
  }, [drones, connectDroneWS])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', width:'100vw', overflow:'hidden', background:'var(--bg)' }}>

      {/* Top connection bar */}
      <MultiConnectionBar
        drones={drones}
        selectedDroneId={selectedDroneId}
        selectedDroneIds={selectedDroneIds}
        onSelectDrone={setSelectedDroneId}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onAddDrone={handleAddDrone}
        onRemoveDrone={handleRemoveDrone}
        targetMode={targetMode}
        onSetTargetMode={(mode) => { setTargetMode(prev => prev === mode ? null : mode) }}
        onSendAllToTarget={sendSelectedToTarget}
        onStartScan={() => {
          if (scanArea) {
            console.log('Starting scan with selected drone', selectedDrone.id, 'over', scanArea)
          }
        }}
      />

      {/* Main body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Side menu */}
        <SideMenu
          visiblePanels={visiblePanels}
          onToggle={togglePanel}
          onResetLayout={resetLayout}
        />

        {/* Canvas */}
        <div style={{
          flex:1,
          position:'relative',
          overflow:'hidden',
          padding:`${CANVAS_PAD_TOP}px ${CANVAS_PAD_X}px 4px ${CANVAS_PAD_X}px`,
        }}>

          {/* HUD Panel */}
          {visiblePanels.hud && (
            <DraggablePanel
              id="hud" title="Primary Flight Display"
              defaultX={LEFT_X} defaultY={TOP_Y} defaultW={LEFT_W} defaultH={TOP_H}
              minW={300} minH={200} onFocus={bringToFront} zIndex={zOrders.hud}
              onClose={handlePanelClose} resetKey={resetKey}
            >
              <HUD telemetry={selectedDrone.telemetry} />
            </DraggablePanel>
          )}

          {/* Map Panel */}
          {visiblePanels.map && (
            <DraggablePanel
              id="map" title="Satellite Map"
              defaultX={mapX} defaultY={TOP_Y} defaultW={mapWidth} defaultH={mapHeight}
              minW={350} minH={200} onFocus={bringToFront} zIndex={zOrders.map}
              onClose={handlePanelClose} resetKey={resetKey}
            >
              <MapView
                drones={drones}
                selectedDroneId={selectedDrone.id}
                selectedDroneIds={selectedDroneIds}
                telemetry={selectedDrone.telemetry}
                swarmDrones={swarmData.drones}
                onDroneSelect={toggleDroneSelection}
                onDroneFocus={setPrimaryDrone}
                onTargetSet={(pt) => { setTargetPoint(pt); selectedTargetRef.current = selectedDrone.id; setTargetMode(null) }}
                targetMode={targetMode}
                scanArea={scanArea}
                onScanAreaSet={(area) => { setScanArea(area); setTargetMode(null) }}
                send={selectedSend}
              />
            </DraggablePanel>
          )}

          {/* Telemetry/Actions/Messages Panel */}
          {visiblePanels.tel && (
            <DraggablePanel
              id="tel" title="Ground Control"
              defaultX={LEFT_X} defaultY={bottomY} defaultW={LEFT_W} defaultH={BOTTOM_H}
              minW={280} minH={200} onFocus={bringToFront} zIndex={zOrders.tel}
              onClose={handlePanelClose} resetKey={resetKey}
            >
              <div className="panel-no-drag" style={{ display:'flex', background:'var(--panel2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                {[['quick','Telemetry'],['actions','Actions'],['messages','Messages']].map(([id,label]) => (
                  <button key={id} onClick={() => setActiveTab(id)} style={{
                    padding:'5px 14px', border:'none',
                    background: activeTab===id ? 'var(--panel)' : 'transparent',
                    color: activeTab===id ? 'var(--accent)' : 'var(--muted)',
                    borderBottom: activeTab===id ? '2px solid var(--accent)' : '2px solid transparent',
                    fontSize:11, fontWeight:600, cursor:'pointer', letterSpacing:'0.04em', textTransform:'uppercase'
                  }}>
                    {label}
                    {id==='messages' && messages.length>0 &&
                      <span style={{ marginLeft:4, background:'var(--accent)', color:'#000', borderRadius:8, padding:'0 4px', fontSize:9 }}>{messages.length}</span>}
                  </button>
                ))}
              </div>
              <div style={{ flex:1, overflow:'hidden', height:'calc(100% - 30px)' }}>
                {activeTab === 'quick'    && <TelemetryPanel telemetry={selectedDrone.telemetry} />}
                {activeTab === 'actions'  && <ActionsPanel   send={selectedSend} telemetry={selectedDrone.telemetry} connected={selectedDrone.connected} linkReady={selectedDrone.linkReady} />}
                {activeTab === 'messages' && <MessagesPanel  messages={messages} />}
              </div>
            </DraggablePanel>
          )}

          {/* Message Log Panel */}
          {visiblePanels.msg && (
            <DraggablePanel
              id="msg" title="Message Log"
              defaultX={mapX} defaultY={logY} defaultW={mapWidth} defaultH={LOG_H}
              minW={300} minH={100} onFocus={bringToFront} zIndex={zOrders.msg}
              onClose={handlePanelClose} resetKey={resetKey}
            >
              <MessagesPanel messages={messages} />
            </DraggablePanel>
          )}

          {/* Drone Fleet Panel */}
          {visiblePanels.drones && (
            <DraggablePanel
              id="drones" title="Swarm Control"
              defaultX={rightX} defaultY={TOP_Y} defaultW={RIGHT_W} defaultH={586}
              minW={240} minH={200} onFocus={bringToFront} zIndex={zOrders.drones}
              onClose={handlePanelClose} resetKey={resetKey}
            >
              <SwarmPanel
                send={sendSwarm}
                swarmData={swarmData}
                connected={drones.some(d => d.connected)}
              />
            </DraggablePanel>
          )}

          {visiblePanels.fleet && (
            <DraggablePanel
              id="fleet" title="Fleet Monitor"
              defaultX={rightX} defaultY={TOP_Y} defaultW={RIGHT_W} defaultH={586}
              minW={220} minH={240} onFocus={bringToFront} zIndex={zOrders.fleet}
              onClose={handlePanelClose} resetKey={resetKey}
            >
              <DroneOverviewPanel
                drones={drones}
                selectedDroneId={selectedDroneId}
                selectedDroneIds={selectedDroneIds}
                onSelectDrone={setPrimaryDrone}
                onToggleDroneSelect={toggleDroneSelection}
                onSelectAll={selectAllDrones}
                onClearSelection={clearSelectedDrones}
                onBatchTakeoff={handleBatchTakeoff}
              />
            </DraggablePanel>
          )}

          {/* Not connected overlay */}
          {drones.every(d => !d.connected) && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)',
              display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, pointerEvents:'none' }}>
              <div style={{ background:'#111', border:'1px solid var(--border)', borderRadius:6,
                padding:'16px 28px', textAlign:'center', pointerEvents:'all' }}>
                <div style={{ fontSize:14, color:'var(--muted)', marginBottom:8 }}>No drones connected</div>
                <div style={{ fontSize:11, color:'#555', lineHeight:2, fontFamily:'var(--mono)' }}>
                  UDP defaults: <code style={{color:'#888'}}>14680</code>, <code style={{color:'#888'}}>14690</code>, <code style={{color:'#888'}}>14700</code><br/>
                  Example: <code style={{color:'#888'}}>--out=127.0.0.1:14680</code> for D1
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <StatusBar telemetry={selectedDrone.telemetry} />
    </div>
  )
}
