import React from 'react'

export default function StatusBar({ telemetry }) {
  const { voltage_battery=0, current_battery=0, battery_remaining=-1,
          gps_fix='--', satellites=0, hdop=0, mode='--', armed=false } = telemetry

  const batColor = battery_remaining < 20 ? '#f44336' : battery_remaining < 40 ? '#ff9800' : '#4caf50'

  const Cell = ({ label, value, color='#aaa' }) => (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'0 10px', borderRight:'1px solid #333' }}>
      <span style={{ fontSize:10, color:'#555' }}>{label}</span>
      <span style={{ fontSize:11, fontFamily:'var(--mono)', color, fontWeight:600 }}>{value}</span>
    </div>
  )

  return (
    <div style={{ display:'flex', alignItems:'center', height:26, background:'#0d0d0d',
      borderTop:'1px solid #2a2a2a', flexShrink:0, overflow:'hidden' }}>
      <Cell label="MODE"   value={mode}                              color="var(--accent)" />
      <Cell label="STATUS" value={armed ? 'ARMED' : 'DISARMED'}     color={armed ? '#ffd600' : '#f44336'} />
      <Cell label="BAT"    value={`${voltage_battery.toFixed(2)}V`} color={batColor} />
      <Cell label="CURR"   value={`${current_battery.toFixed(1)}A`} color="#aaa" />
      <Cell label="BATT%"  value={battery_remaining >= 0 ? `${battery_remaining}%` : '--'} color={batColor} />
      <Cell label="GPS"    value={gps_fix}                          color={gps_fix==='3D'||gps_fix==='RTK_FIXED' ? '#4caf50' : '#f44336'} />
      <Cell label="SATS"   value={satellites}                       color="#aaa" />
      <Cell label="HDOP"   value={hdop.toFixed(2)}                  color={hdop < 2 ? '#4caf50' : '#ff9800'} />
      <div style={{ marginLeft:'auto', padding:'0 10px', fontSize:10, color:'#444', fontFamily:'var(--mono)' }}>
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}
