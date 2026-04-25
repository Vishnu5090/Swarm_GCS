import React from 'react'

const menuItems = [
  { id: 'hud', icon: 'A', label: 'PFD' },
  { id: 'map', icon: 'M', label: 'Map' },
  { id: 'tel', icon: 'D', label: 'Data' },
  { id: 'msg', icon: 'L', label: 'Log' },
  { id: 'drones', icon: 'S', label: 'Swarm' },
  { id: 'fleet', icon: 'F', label: 'Fleet' },
]

export default function SideMenu({ visiblePanels, onToggle, onResetLayout }) {
  return (
    <div style={{
      width: 54,
      background: '#111',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0',
      gap: 4,
      flexShrink: 0,
      zIndex: 2000,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'radial-gradient(circle, #00b4d822, #00b4d800)',
        border: '1.5px solid var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8, fontSize: 14, color: 'var(--accent)',
        fontFamily: 'var(--mono)', fontWeight: 700
      }}>
        G
      </div>

      <div style={{ width: 32, height: 1, background: 'var(--border)', marginBottom: 4 }} />

      {menuItems.map(item => {
        const active = visiblePanels[item.id] !== false
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            title={active ? `Hide ${item.label}` : `Show ${item.label}`}
            style={{
              width: 42, height: 42, border: 'none', borderRadius: 4,
              background: active ? 'var(--accent)18' : 'transparent',
              borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              color: active ? 'var(--accent)' : '#555',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, transition: 'all 0.15s',
              fontSize: 16,
            }}
            onMouseOver={e => { if (!active) e.currentTarget.style.color = '#888' }}
            onMouseOut={e => { if (!active) e.currentTarget.style.color = '#555' }}
          >
            <span style={{ fontSize: 15, lineHeight: 1, fontFamily: 'var(--mono)', fontWeight: 700 }}>{item.icon}</span>
            <span style={{ fontSize: 8, letterSpacing: '0.04em', lineHeight: 1, fontFamily: 'var(--mono)' }}>
              {item.label}
            </span>
          </button>
        )
      })}

      <div style={{ flex: 1 }} />
      <div style={{ width: 32, height: 1, background: 'var(--border)', marginBottom: 4 }} />

      <button
        onClick={onResetLayout}
        title="Reset Window Layout"
        style={{
          width: 42, height: 42, border: '1px solid #444', borderRadius: 4,
          background: 'transparent', color: '#888', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, fontSize: 13
        }}
        onMouseOver={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#fff' }}
        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
      >
        <span style={{ fontSize: 15, fontFamily: 'var(--mono)' }}>R</span>
        <span style={{ fontSize: 7, fontFamily: 'var(--mono)', letterSpacing: '0.03em' }}>RESET</span>
      </button>
    </div>
  )
}
