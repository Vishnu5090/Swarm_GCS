import React from 'react'

function Gauge({ label, value, unit='', color='#e040fb', digits=2 }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 4px',
      borderRight:'1px solid var(--border)', flex:1 }}>
      <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.04em', marginBottom:2, textTransform:'uppercase' }}>{label}</span>
      <span style={{ fontFamily:'var(--mono)', fontSize:28, fontWeight:'bold', color, lineHeight:1 }}>
        {typeof value === 'number' ? value.toFixed(digits) : value}
      </span>
      {unit && <span style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{unit}</span>}
    </div>
  )
}

export default function TelemetryPanel({ telemetry }) {
  const { altitude=0, groundspeed=0, wp_dist=0, yaw=0, climb=0, dist_to_mav=0,
          airspeed=0, roll=0, pitch=0, throttle=0 } = telemetry
  const yawDeg = ((yaw * 180 / Math.PI) % 360 + 360) % 360

  return (
    <div style={{ height:'100%', overflowY:'auto', background:'var(--panel)' }}>
      {/* Row 1 */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        <Gauge label="Altitude (m)"    value={altitude}        color="#e040fb" digits={2} />
        <Gauge label="GroundSpeed m/s" value={groundspeed}     color="#ff9800" digits={2} />
      </div>
      {/* Row 2 */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        <Gauge label="Dist to WP (m)" value={wp_dist}          color="#f44336" digits={2} />
        <Gauge label="Yaw (deg)"      value={yawDeg}           color="#4caf50" digits={2} />
      </div>
      {/* Row 3 */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        <Gauge label="Vertical Spd m/s" value={climb}          color="#ffd600" digits={2} />
        <Gauge label="DistToMAV (m)"  value={dist_to_mav}      color="#00bcd4" digits={2} />
      </div>
      {/* Row 4 – extra */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        <Gauge label="Airspeed m/s"   value={airspeed}         color="#7c4dff" digits={2} />
        <Gauge label="Throttle %"     value={throttle}         color="#ff5722" digits={0} />
      </div>
      <div style={{ display:'flex' }}>
        <Gauge label="Roll (deg)"     value={roll * 180/Math.PI} color="#26c6da" digits={1} />
        <Gauge label="Pitch (deg)"    value={pitch * 180/Math.PI} color="#a5d6a7" digits={1} />
      </div>
    </div>
  )
}
