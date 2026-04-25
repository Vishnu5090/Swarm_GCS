import React, { useEffect, useRef, useState } from 'react'

const GOOGLE_MAPS_API_KEY = 'AIzaSyDKsLXiABqHOOoDQD0En6iC_XkZORyv10k'
const GOOGLE_MAP_ID = 'DEMO_MAP_ID'
const DRONE_COLOR_LEADER = '#4caf50'
const DRONE_COLOR_FOLLOWER = '#00b4d8'
const DRONE_COLOR_SINGLE = '#ff5a36'

const DRONE_COLORS = ['#ff5a36','#00e5ff','#69ff47','#ff1744','#ffd600','#d500f9','#ff6d00','#00e676']

let mapsLoaded = false
let mapsCallbacks = []

function loadGoogleMaps(cb) {
  if (mapsLoaded) { cb(); return }
  mapsCallbacks.push(cb)
  if (document.getElementById('gmap')) return
  window.__gmapReady = () => {
    mapsLoaded = true
    mapsCallbacks.forEach(fn => fn())
    mapsCallbacks = []
  }
  const script = document.createElement('script')
  script.id = 'gmap'
  script.async = true
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=__gmapReady&loading=async&libraries=marker&v=weekly`
  document.head.appendChild(script)
}

function hasValidGPS(lat, lon) {
  return lat != null && lon != null && !(lat === 0 && lon === 0)
}

function pickDroneSource(swarmDrone, telemetry) {
  if (swarmDrone && hasValidGPS(swarmDrone.lat, swarmDrone.lon)) return swarmDrone
  return telemetry || {}
}

function isValidTarget(target) {
  return target && typeof target.lat === 'number' && typeof target.lng === 'number'
}

function isValidScanArea(bounds) {
  return bounds &&
    typeof bounds.north === 'number' &&
    typeof bounds.south === 'number' &&
    typeof bounds.east === 'number' &&
    typeof bounds.west === 'number'
}

function getRoleColor(role, fallback) {
  if (role === 'leader') return DRONE_COLOR_LEADER
  if (role === 'follower') return DRONE_COLOR_FOLLOWER
  return fallback || DRONE_COLOR_SINGLE
}

function createDroneMarkerEl(color, label, selected = false) {
  const el = document.createElement('div')
  el.style.cssText = `
    width:30px; height:30px; position:relative; cursor:pointer;
  `
  el.innerHTML = `
    <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="13" fill="${selected ? `${color}40` : `${color}22`}" stroke="${selected ? '#ffffff' : color}" stroke-width="${selected ? 2.3 : 1.5}"/>
      <polygon points="15,4 19,22 15,18 11,22" fill="${color}" stroke="#000" stroke-width="0.5"/>
      <text x="15" y="15" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="8" font-family="monospace" font-weight="bold">${label}</text>
    </svg>
  `
  return el
}

function updateDroneMarkerEl(marker, color, label, heading, selected = false) {
  if (!marker?.content) return
  marker.content.innerHTML = `
    <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${heading || 0}deg)">
      <circle cx="15" cy="15" r="13" fill="${selected ? `${color}40` : `${color}22`}" stroke="${selected ? '#ffffff' : color}" stroke-width="${selected ? 2.3 : 1.5}"/>
      <polygon points="15,4 19,22 15,18 11,22" fill="${color}" stroke="#000" stroke-width="0.5"/>
      <text x="15" y="15" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="8" font-family="monospace" font-weight="bold">${label}</text>
    </svg>
  `
}

function createTargetMarkerEl() {
  const el = document.createElement('div')
  el.style.cssText = 'width:24px; height:24px; cursor:crosshair;'
  el.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" fill="none" stroke="#ffd600" stroke-width="2" stroke-dasharray="4,2"/>
      <line x1="12" y1="0" x2="12" y2="24" stroke="#ffd600" stroke-width="1" opacity="0.7"/>
      <line x1="0" y1="12" x2="24" y2="12" stroke="#ffd600" stroke-width="1" opacity="0.7"/>
      <circle cx="12" cy="12" r="3" fill="#ffd600"/>
    </svg>
  `
  return el
}

// Generate scan pattern waypoints for a rectangular area
function generateScanPattern(bounds, numDrones) {
  const { north, south, east, west } = bounds
  const latRange = north - south
  const lngRange = east - west
  // Create lawnmower pattern
  const strips = Math.max(numDrones, Math.ceil(latRange / 0.0001))
  const stripLat = latRange / strips
  const allWaypoints = []
  for (let s = 0; s < strips; s++) {
    const lat = south + (s + 0.5) * stripLat
    if (s % 2 === 0) {
      allWaypoints.push({ lat, lng: west })
      allWaypoints.push({ lat, lng: east })
    } else {
      allWaypoints.push({ lat, lng: east })
      allWaypoints.push({ lat, lng: west })
    }
  }
  // Distribute waypoints to drones
  const perDrone = Math.ceil(allWaypoints.length / numDrones)
  return Array.from({ length: numDrones }, (_, i) =>
    allWaypoints.slice(i * perDrone, (i + 1) * perDrone)
  )
}

export default function MapView({
  drones = [],
  selectedDroneId,
  selectedDroneIds = [],
  telemetry = {},
  swarmDrones = [],
  onDroneSelect,
  onDroneFocus,
  onTargetSet,
  targetMode,
  scanArea,
  onScanAreaSet,
}) {
  const divRef = useRef(null)
  const mapRef = useRef(null)
  const markerRefs = useRef({})
  const pathRefs = useRef({})
  const pathCoords = useRef({})
  const targetMarkerRef = useRef(null)
  const scanRectRef = useRef(null)
  const scanWpMarkersRef = useRef([])
  const initiated = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [currentTarget, setCurrentTarget] = useState(null)
  const scanStartRef = useRef(null)
  const isDrawingRef = useRef(false)
  const clickListenerRef = useRef(null)
  const mouseMoveListenerRef = useRef(null)
  const pendingCenterRef = useRef(null)

  useEffect(() => {
    loadGoogleMaps(async () => {
      if (initiated.current || !divRef.current) return
      initiated.current = true
      const defaultCenter = { lat: 13.0827, lng: 80.2703 }
      await window.google.maps.importLibrary('marker')

      const map = new window.google.maps.Map(divRef.current, {
        center: defaultCenter,
        zoom: 16,
        mapTypeId: 'satellite',
        mapTypeControl: true,
        mapTypeControlOptions: { position: window.google.maps.ControlPosition.TOP_RIGHT },
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        mapId: GOOGLE_MAP_ID,
      })
      mapRef.current = map
      setMapReady(true)
    })
  }, [])

  useEffect(() => {
    pendingCenterRef.current = selectedDroneId
  }, [selectedDroneId])

  // Handle map click for target/scan mode
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (clickListenerRef.current) window.google.maps.event.removeListener(clickListenerRef.current)
    if (mouseMoveListenerRef.current) window.google.maps.event.removeListener(mouseMoveListenerRef.current)

    if (targetMode === 'point') {
      map.setOptions({ draggableCursor: 'crosshair' })
      clickListenerRef.current = map.addListener('click', (e) => {
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()
        setCurrentTarget({ lat, lng })
        onTargetSet?.({ lat, lng })
      })
    } else if (targetMode === 'scan') {
      map.setOptions({ draggableCursor: 'crosshair' })
      clickListenerRef.current = map.addListener('click', (e) => {
        if (!isDrawingRef.current) {
          scanStartRef.current = { lat: e.latLng.lat(), lng: e.latLng.lng() }
          isDrawingRef.current = true
        } else {
          const end = { lat: e.latLng.lat(), lng: e.latLng.lng() }
          const start = scanStartRef.current
          const bounds = {
            north: Math.max(start.lat, end.lat),
            south: Math.min(start.lat, end.lat),
            east: Math.max(start.lng, end.lng),
            west: Math.min(start.lng, end.lng),
          }
          onScanAreaSet?.(bounds)
          isDrawingRef.current = false
          scanStartRef.current = null
          map.setOptions({ draggableCursor: null })
        }
      })
      mouseMoveListenerRef.current = map.addListener('mousemove', (e) => {
        if (!isDrawingRef.current || !scanStartRef.current) return
        const start = scanStartRef.current
        const end = { lat: e.latLng.lat(), lng: e.latLng.lng() }
        if (!scanRectRef.current) {
          scanRectRef.current = new window.google.maps.Rectangle({
            map,
            bounds: { north: start.lat, south: end.lat, east: end.lng, west: start.lng },
            strokeColor: '#ffd600',
            strokeWeight: 2,
            fillColor: '#ffd600',
            fillOpacity: 0.1,
            strokeDashOffset: 5,
          })
        } else {
          scanRectRef.current.setBounds({
            north: Math.max(start.lat, end.lat),
            south: Math.min(start.lat, end.lat),
            east: Math.max(start.lng, end.lng),
            west: Math.min(start.lng, end.lng),
          })
        }
      })
    } else {
      map.setOptions({ draggableCursor: null })
    }

    return () => {
      if (clickListenerRef.current) window.google.maps.event.removeListener(clickListenerRef.current)
      if (mouseMoveListenerRef.current) window.google.maps.event.removeListener(mouseMoveListenerRef.current)
    }
  }, [mapReady, targetMode])

  // Draw scan area and waypoints
  useEffect(() => {
    if (!mapReady || !isValidScanArea(scanArea)) return
    const map = mapRef.current
    if (scanRectRef.current) { scanRectRef.current.setMap(null); scanRectRef.current = null }
    scanWpMarkersRef.current.forEach(m => m.setMap ? m.setMap(null) : (m.map = null))
    scanWpMarkersRef.current = []

    scanRectRef.current = new window.google.maps.Rectangle({
      map,
      bounds: scanArea,
      strokeColor: '#ffd600',
      strokeWeight: 2,
      fillColor: '#ffd600',
      fillOpacity: 0.08,
    })

    // Draw scan lines
    const activeDrones = drones.filter(d => d.connected)
    const patterns = generateScanPattern(scanArea, Math.max(1, activeDrones.length))
    const lineColors = ['#ff5a36','#00e5ff','#69ff47','#ffd600','#d500f9']
    patterns.forEach((wps, di) => {
      if (wps.length < 2) return
      const line = new window.google.maps.Polyline({
        map,
        path: wps,
        strokeColor: lineColors[di % lineColors.length],
        strokeWeight: 1.5,
        strokeOpacity: 0.7,
        icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2 }, repeat: '80px' }],
      })
      scanWpMarkersRef.current.push(line)
    })
  }, [mapReady, scanArea, drones.length])

  // Update target marker
  useEffect(() => {
    if (!mapReady) return
    const loadAndUpdate = async () => {
      const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
      if (!isValidTarget(currentTarget)) {
        if (targetMarkerRef.current) targetMarkerRef.current.map = null
        return
      }
      if (!targetMarkerRef.current) {
        targetMarkerRef.current = new AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: currentTarget.lat, lng: currentTarget.lng },
          content: createTargetMarkerEl(),
          title: 'Target',
          zIndex: 20,
        })
      } else {
        targetMarkerRef.current.position = { lat: currentTarget.lat, lng: currentTarget.lng }
        targetMarkerRef.current.map = mapRef.current
      }
    }
    loadAndUpdate()
  }, [mapReady, currentTarget])

  // Update drone markers
  useEffect(() => {
    if (!mapReady) return
    const loadAndUpdate = async () => {
      const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
      const safeSwarmDrones = Array.isArray(swarmDrones) ? swarmDrones.filter(Boolean) : []
      const swarmById = new Map(safeSwarmDrones.map(drone => [drone.id, drone]))
      const activeIds = new Set()

      ;(Array.isArray(drones) ? drones : []).filter(Boolean).forEach((drone, i) => {
        const swarmDrone = swarmById.get(drone.id)
        const source = pickDroneSource(swarmDrone, drone.telemetry)
        const { lat, lon } = source
        const heading = source.heading ?? source.hdg
        const valid = hasValidGPS(lat, lon)
        const isSelected = selectedDroneIds.includes(drone.id)
        const fallbackColor = drones.length === 1 ? DRONE_COLOR_SINGLE : DRONE_COLORS[i % DRONE_COLORS.length]
        const color = getRoleColor(swarmDrone?.role, fallbackColor)
        activeIds.add(String(drone.id))

        if (!markerRefs.current[drone.id]) {
          const content = createDroneMarkerEl(color, drone.id, isSelected)
          markerRefs.current[drone.id] = new AdvancedMarkerElement({
            map: valid ? mapRef.current : null,
            position: valid ? { lat, lng: lon } : { lat: 13.0827, lng: 80.2703 },
            content,
            title: `Drone ${drone.id}`,
            zIndex: 10 + i,
          })
          markerRefs.current[drone.id].addListener('click', () => {
            onDroneSelect?.(drone.id)
            onDroneFocus?.(drone.id)
          })
          if (!pathRefs.current[drone.id]) {
            pathCoords.current[drone.id] = []
            pathRefs.current[drone.id] = new window.google.maps.Polyline({
              map: mapRef.current,
              path: [],
              strokeColor: color,
              strokeWeight: 1.5,
              strokeOpacity: 0.6,
            })
          }
        }

        if (valid) {
          const pos = { lat, lng: lon }
          markerRefs.current[drone.id].map = mapRef.current
          markerRefs.current[drone.id].position = pos
          updateDroneMarkerEl(markerRefs.current[drone.id], color, drone.id, heading, isSelected)

          const coords = pathCoords.current[drone.id] || []
          const last = coords[coords.length - 1]
          if (!last || last.lat !== lat || last.lng !== lon) {
            coords.push(pos)
            if (coords.length > 1000) coords.shift()
            pathCoords.current[drone.id] = coords
            pathRefs.current[drone.id]?.setPath(coords)
          }
          if (i === 0 && !currentTarget && coords.length === 1) {
            mapRef.current.panTo(pos)
          }
        } else {
          markerRefs.current[drone.id].map = null
        }
      })

      safeSwarmDrones.forEach((drone, i) => {
        if (activeIds.has(String(drone.id)) || !hasValidGPS(drone.lat, drone.lon)) return

        const color = getRoleColor(drone.role, DRONE_COLORS[i % DRONE_COLORS.length])
        const pos = { lat: drone.lat, lng: drone.lon }
        const isSelected = selectedDroneIds.includes(drone.id)
        activeIds.add(String(drone.id))

        if (!markerRefs.current[drone.id]) {
          markerRefs.current[drone.id] = new AdvancedMarkerElement({
            map: mapRef.current,
            position: pos,
            content: createDroneMarkerEl(color, drone.id, isSelected),
            title: `Drone ${drone.id}`,
            zIndex: 10 + i,
          })
          markerRefs.current[drone.id].addListener('click', () => {
            onDroneSelect?.(drone.id)
            onDroneFocus?.(drone.id)
          })
        } else {
          markerRefs.current[drone.id].map = mapRef.current
          markerRefs.current[drone.id].position = pos
        }

        updateDroneMarkerEl(markerRefs.current[drone.id], color, drone.id, drone.heading ?? drone.hdg, isSelected)
      })

      Object.keys(markerRefs.current).forEach((id) => {
        if (activeIds.has(id)) return
        markerRefs.current[id].map = null
        delete markerRefs.current[id]
        if (pathRefs.current[id]) {
          pathRefs.current[id].setMap(null)
          delete pathRefs.current[id]
        }
        delete pathCoords.current[id]
      })
    }
    loadAndUpdate()
  }, [mapReady, drones, swarmDrones, selectedDroneIds, onDroneSelect, onDroneFocus])

  useEffect(() => {
    if (!mapReady || !mapRef.current || pendingCenterRef.current == null) return
    const selected = (Array.isArray(drones) ? drones : []).find(drone => drone?.id === selectedDroneId)
    if (!selected) return
    const swarmDrone = (Array.isArray(swarmDrones) ? swarmDrones : []).find(drone => drone?.id === selectedDroneId)
    const source = pickDroneSource(swarmDrone, selected.telemetry)
    if (!hasValidGPS(source?.lat, source?.lon)) return
    mapRef.current.panTo({ lat: source.lat, lng: source.lon })
    pendingCenterRef.current = null
  }, [mapReady, selectedDroneId, drones, swarmDrones])

  const tel = telemetry || drones[0]?.telemetry || {}
  const swarmCount = Array.isArray(swarmDrones) ? swarmDrones.length : 0
  const safeTarget = isValidTarget(currentTarget) ? currentTarget : null

  return (
    <div style={{ position:'relative', width:'100%', height:'100%' }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }} />

      {/* Coord overlay */}
      <div style={{
        position:'absolute', bottom:8, left:8,
        background:'rgba(0,0,0,0.75)', padding:'4px 8px', borderRadius:4,
        fontSize:11, fontFamily:'var(--mono)', color:'#aaa', lineHeight:1.8,
        pointerEvents:'none'
      }}>
        <span style={{ color:'#00b4d8' }}>LAT</span> {(tel.lat||0).toFixed(6)}{'  '}
        <span style={{ color:'#00b4d8' }}>LON</span> {(tel.lon||0).toFixed(6)}
        <span style={{ color:'#00b4d8', marginLeft:8 }}>ALT</span> {(tel.altitude||0).toFixed(1)}m
        {safeTarget && (
          <span style={{ color:'#ffd600', marginLeft:8 }}>
            TGT {safeTarget.lat.toFixed(5)}, {safeTarget.lng.toFixed(5)}
          </span>
        )}
      </div>

      {/* Collision avoidance status */}
      <div style={{
        position:'absolute', top:8, left:8,
        background:'rgba(0,30,0,0.85)', padding:'4px 10px', borderRadius:4,
        fontSize:10, fontFamily:'var(--mono)', color:'#4caf50', lineHeight:1.8,
        border:'1px solid #4caf50', pointerEvents:'none',
        display:'flex', alignItems:'center', gap:6
      }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#4caf50', boxShadow:'0 0 6px #4caf50' }} />
        COLLISION AVOIDANCE ACTIVE
      </div>

      {/* GPS status */}
      <div style={{
        position:'absolute', bottom:8, right:8,
        background:'rgba(0,0,0,0.75)', padding:'4px 8px', borderRadius:4,
        fontSize:11, fontFamily:'var(--mono)', color:'#aaa', lineHeight:1.8,
        pointerEvents:'none'
      }}>
        <span style={{ color: tel.gps_fix === 'NO_GPS' ? '#f44336' : '#4caf50' }}>GPS</span>{' '}
        {tel.gps_fix||'--'}{'  '}
        <span style={{ color:'#4caf50' }}>SATS</span> {tel.satellites||0}
        {'  '}
        <span style={{ color:'#4caf50' }}>HDOP</span> {(tel.hdop||0).toFixed(2)}
      </div>

      {swarmCount > 0 && (
        <div style={{
          position:'absolute', top:44, left:8,
          background:'rgba(0,0,0,0.75)', padding:'4px 10px', borderRadius:4,
          fontSize:10, fontFamily:'var(--mono)', color:'#00b4d8',
          display:'flex', alignItems:'center', gap:6, pointerEvents:'none'
        }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#00b4d8', boxShadow:'0 0 5px #00b4d8' }} />
          SWARM: {swarmCount} DRONES
        </div>
      )}

      {/* Mode hint */}
      {targetMode === 'point' && (
        <div style={{
          position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          background:'rgba(0,0,0,0.8)', border:'2px solid #ffd600', borderRadius:6,
          padding:'8px 16px', color:'#ffd600', fontSize:13, fontFamily:'var(--mono)',
          pointerEvents:'none', letterSpacing:'0.05em'
        }}>
          CLICK MAP TO SET TARGET
        </div>
      )}
      {targetMode === 'scan' && (
        <div style={{
          position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          background:'rgba(0,0,0,0.8)', border:'2px solid #ffd600', borderRadius:6,
          padding:'8px 16px', color:'#ffd600', fontSize:13, fontFamily:'var(--mono)',
          pointerEvents:'none', letterSpacing:'0.05em', textAlign:'center'
        }}>
          {isDrawingRef.current ? 'CLICK SECOND CORNER TO COMPLETE SCAN AREA' : 'CLICK FIRST CORNER OF SCAN AREA'}
        </div>
      )}
    </div>
  )
}
