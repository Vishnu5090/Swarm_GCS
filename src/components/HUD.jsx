import React, { useEffect, useRef } from 'react'

const DEG = Math.PI / 180

function num(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function draw(canvas, tel) {
  if (!canvas) return
  const W = canvas.width, H = canvas.height
  // Guard: canvas not yet sized (e.g. on first mount before layout)
  if (W === 0 || H === 0) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const cx = W / 2, cy = H / 2
  // Guard: tel may be undefined/null before first telemetry arrives
  const {
    roll: rawRoll = 0,
    pitch: rawPitch = 0,
    yaw: rawYaw = 0,
    heading: rawHeading = 0,
    airspeed: rawAirspeed = 0,
    groundspeed: rawGroundspeed = 0,
    altitude: rawAltitude = 0,
    climb: rawClimb = 0,
    throttle: rawThrottle = 0,
    armed = false,
    mode = 'STABILIZE',
  } = tel ?? {}
  const roll = num(rawRoll)
  const pitch = num(rawPitch)
  const yaw = num(rawYaw)
  const heading = num(rawHeading)
  const airspeed = num(rawAirspeed)
  const groundspeed = num(rawGroundspeed)
  const altitude = num(rawAltitude)
  const climb = num(rawClimb)
  const throttle = Math.max(0, Math.min(100, num(rawThrottle)))

  ctx.clearRect(0, 0, W, H)

  const PX_PER_DEG = H / 50   // 50 degrees fills full height

  // ── Horizon (rotated) ───────────────────────────────────────────────────────
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip()
  ctx.translate(cx, cy)
  ctx.rotate(-roll * DEG)

  const pitchOffset = pitch * PX_PER_DEG

  // Sky
  const skyGrad = ctx.createLinearGradient(0, -H, 0, pitchOffset)
  skyGrad.addColorStop(0, '#1a3a6e'); skyGrad.addColorStop(1, '#2a6fa8')
  ctx.fillStyle = skyGrad
  ctx.fillRect(-W, -H - pitchOffset, W * 2, H * 2)

  // Ground
  const gndGrad = ctx.createLinearGradient(0, pitchOffset, 0, H)
  gndGrad.addColorStop(0, '#5c3a0a'); gndGrad.addColorStop(1, '#3a2200')
  ctx.fillStyle = gndGrad
  ctx.fillRect(-W, pitchOffset, W * 2, H * 2)

  // Horizon line
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-W, pitchOffset); ctx.lineTo(W, pitchOffset); ctx.stroke()

  // Pitch ladder
  ctx.font = '10px Share Tech Mono'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
  for (let deg = -30; deg <= 30; deg += 5) {
    if (deg === 0) continue
    const y = pitchOffset - deg * PX_PER_DEG
    const len = deg % 10 === 0 ? 35 : 20
    ctx.strokeStyle = '#fff'; ctx.lineWidth = deg % 10 === 0 ? 1.5 : 1
    ctx.beginPath(); ctx.moveTo(-len, y); ctx.lineTo(len, y); ctx.stroke()
    if (deg % 10 === 0) {
      ctx.fillText(Math.abs(deg), -len - 14, y + 4)
      ctx.fillText(Math.abs(deg), len + 14, y + 4)
    }
  }

  ctx.restore()

  // ── Fixed HUD elements (not rotated) ──────────────────────────────────────

  // Roll indicator arc
  ctx.save(); ctx.translate(cx, cy)
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, 0, cy - 12, -150*DEG, -30*DEG); ctx.stroke();
  // Roll tick marks
  [-60,-45,-30,-20,-10,0,10,20,30,45,60].forEach(a => {
    const r = cy - 12, len = [60,45,30].includes(Math.abs(a)) ? 9 : 5
    ctx.save(); ctx.rotate((a - 90) * DEG)
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r + len)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore()
  })
  // Roll pointer
  ctx.save(); ctx.rotate(-roll * DEG)
  ctx.fillStyle = '#ffd600'; ctx.beginPath()
  ctx.moveTo(0, -(cy-22)); ctx.lineTo(-5, -(cy-12)); ctx.lineTo(5, -(cy-12)); ctx.closePath(); ctx.fill()
  ctx.restore(); ctx.restore()

  // Center crosshair
  ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 2
  // Left wing
  ctx.beginPath(); ctx.moveTo(cx - 60, cy); ctx.lineTo(cx - 20, cy); ctx.lineTo(cx - 20, cy + 10); ctx.stroke()
  // Right wing
  ctx.beginPath(); ctx.moveTo(cx + 60, cy); ctx.lineTo(cx + 20, cy); ctx.lineTo(cx + 20, cy + 10); ctx.stroke()
  // Center dot
  ctx.fillStyle = '#ffd600'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()

  // ── Speed tape (left) ───────────────────────────────────────────────────────
  const tapeX = 2, tapeW = 52, tapeH = H
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(tapeX, 0, tapeW, tapeH)

  ctx.font = '11px Share Tech Mono'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right'
  const spd = airspeed
  for (let v = Math.floor(spd / 5) * 5 - 25; v <= spd + 25; v += 5) {
    const dy = (spd - v) * 6
    if (Math.abs(dy) > tapeH / 2 + 20) continue
    const y = cy + dy
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(tapeX + tapeW - (v % 10 === 0 ? 8 : 4), y); ctx.lineTo(tapeX + tapeW, y); ctx.stroke()
    if (v % 10 === 0) { ctx.fillStyle = '#ccc'; ctx.fillText(v.toFixed(0), tapeX + tapeW - 10, y + 4) }
  }
  // Speed box
  ctx.fillStyle = '#000'; ctx.fillRect(tapeX, cy - 10, tapeW, 20)
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(tapeX, cy - 10, tapeW, 20)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Share Tech Mono'; ctx.textAlign = 'center'
  ctx.fillText(spd.toFixed(1), tapeX + tapeW / 2, cy + 5)
  // Label
  ctx.font = '9px Share Tech Mono'; ctx.fillStyle = '#aaa'; ctx.fillText('AS m/s', tapeX + tapeW / 2, 12)
  ctx.fillText(`GS ${groundspeed.toFixed(1)}`, tapeX + tapeW / 2, H - 4)

  // ── Altitude tape (right) ───────────────────────────────────────────────────
  const altX = W - tapeW - 2
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(altX, 0, tapeW, tapeH)
  ctx.textAlign = 'left'
  for (let v = Math.floor(altitude / 5) * 5 - 25; v <= altitude + 25; v += 5) {
    const dy = (altitude - v) * 6
    if (Math.abs(dy) > tapeH / 2 + 20) continue
    const y = cy + dy
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(altX, y); ctx.lineTo(altX + (v % 10 === 0 ? 8 : 4), y); ctx.stroke()
    if (v % 10 === 0) { ctx.font = '11px Share Tech Mono'; ctx.fillStyle = '#ccc'; ctx.fillText(v.toFixed(0), altX + 10, y + 4) }
  }
  ctx.fillStyle = '#000'; ctx.fillRect(altX, cy - 10, tapeW, 20)
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(altX, cy - 10, tapeW, 20)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Share Tech Mono'; ctx.textAlign = 'center'
  ctx.fillText(altitude.toFixed(1), altX + tapeW / 2, cy + 5)
  ctx.font = '9px Share Tech Mono'; ctx.fillStyle = '#aaa'
  ctx.fillText('ALT m', altX + tapeW / 2, 12)
  ctx.fillStyle = climb >= 0 ? '#4caf50' : '#f44336'
  ctx.fillText(`${climb >= 0 ? '+' : ''}${climb.toFixed(1)}`, altX + tapeW / 2, H - 4)

  // ── Heading tape (top) ──────────────────────────────────────────────────────
  const htH = 26
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(tapeW + 4, 0, W - tapeW * 2 - 8, htH)
  const hdgTapeW = W - tapeW * 2 - 8
  const hdgX = tapeW + 4
  const PX_PER_HDG = hdgTapeW / 60 // 60 degrees visible
  const hdg = heading || (yaw * 180 / Math.PI + 360) % 360
  ctx.save(); ctx.beginPath(); ctx.rect(hdgX, 0, hdgTapeW, htH); ctx.clip()
  const dirs = { 0:'N', 45:'NE', 90:'E', 135:'SE', 180:'S', 225:'SW', 270:'W', 315:'NW' }
  for (let d = -40; d <= 40; d++) {
    const deg = ((hdg + d) % 360 + 360) % 360
    const x = hdgX + hdgTapeW / 2 + d * PX_PER_HDG
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, htH); ctx.lineTo(x, d % 5 === 0 ? htH - 7 : htH - 4); ctx.stroke()
    if (d % 10 === 0) {
      ctx.font = '9px Share Tech Mono'; ctx.fillStyle = '#ccc'; ctx.textAlign = 'center'
      ctx.fillText(dirs[Math.round(deg / 45) * 45] || deg.toFixed(0), x, 10)
    }
  }
  ctx.restore()
  // Heading pointer
  ctx.fillStyle = '#ffd600'; ctx.beginPath()
  ctx.moveTo(hdgX + hdgTapeW / 2, htH); ctx.lineTo(hdgX + hdgTapeW / 2 - 5, htH - 8); ctx.lineTo(hdgX + hdgTapeW / 2 + 5, htH - 8); ctx.closePath(); ctx.fill()
  // HDG box
  ctx.fillStyle = '#111'; ctx.fillRect(hdgX + hdgTapeW / 2 - 20, htH - 1, 40, 14)
  ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 1; ctx.strokeRect(hdgX + hdgTapeW / 2 - 20, htH - 1, 40, 14)
  ctx.fillStyle = '#ffd600'; ctx.font = 'bold 11px Share Tech Mono'; ctx.textAlign = 'center'
  ctx.fillText(hdg.toFixed(0).padStart(3, '0') + '°', hdgX + hdgTapeW / 2, htH + 10)

  // ── Status text ─────────────────────────────────────────────────────────────
  ctx.font = 'bold 18px Share Tech Mono'; ctx.textAlign = 'center'
  ctx.fillStyle = armed ? '#ffd600' : '#f44336'
  ctx.fillText(armed ? 'ARMED' : 'DISARMED', cx, htH + 26)

  ctx.font = '11px Share Tech Mono'; ctx.fillStyle = '#00b4d8'
  ctx.fillText(mode, cx, htH + 42)

  // Throttle bar (bottom)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx - 50, H - 14, 100, 10)
  ctx.fillStyle = '#4caf50'; ctx.fillRect(cx - 50, H - 14, throttle, 10)
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(cx - 50, H - 14, 100, 10)
  ctx.font = '9px Share Tech Mono'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'center'
  ctx.fillText(`THR ${throttle}%`, cx, H - 16)
}

export default function HUD({ telemetry }) {
  const canvasRef = useRef(null)
  const telemetryRef = useRef(telemetry)

  useEffect(() => {
    telemetryRef.current = telemetry
  }, [telemetry])

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width; canvas.height = rect.height
      draw(canvas, telemetryRef.current)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    draw(canvas, telemetry)
  }, [telemetry])

  return <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'100%' }} />
}
