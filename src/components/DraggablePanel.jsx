import React, { useRef, useState, useCallback, useEffect } from 'react'

export default function DraggablePanel({
  id, title, defaultX, defaultY, defaultW, defaultH,
  minW = 200, minH = 120, children, onFocus, zIndex, style = {},
  onClose, resetKey
}) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY })
  const [size, setSize] = useState({ w: defaultW, h: defaultH })
  const [maximized, setMaximized] = useState(false)
  const [hidden, setHidden] = useState(false)
  const preMaxState = useRef(null)
  const dragging = useRef(false)
  const resizing = useRef(false)
  const origin = useRef({})

  useEffect(() => {
    setPos({ x: defaultX, y: defaultY })
    setSize({ w: defaultW, h: defaultH })
    setMaximized(false)
    setHidden(false)
  }, [defaultX, defaultY, defaultW, defaultH, resetKey])

  const onMouseDownDrag = useCallback((e) => {
    if (e.target.closest('.panel-no-drag')) return
    if (maximized) return
    e.preventDefault()
    onFocus?.(id)
    dragging.current = true
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }

    const move = (ev) => {
      if (!dragging.current) return
      setPos({
        x: origin.current.px + ev.clientX - origin.current.mx,
        y: origin.current.py + ev.clientY - origin.current.my,
      })
    }

    const up = () => {
      dragging.current = false
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [id, maximized, onFocus, pos])

  const onMouseDownResize = useCallback((e) => {
    if (maximized) return
    e.preventDefault()
    e.stopPropagation()
    resizing.current = true
    origin.current = { mx: e.clientX, my: e.clientY, sw: size.w, sh: size.h }

    const move = (ev) => {
      if (!resizing.current) return
      setSize({
        w: Math.max(minW, origin.current.sw + ev.clientX - origin.current.mx),
        h: Math.max(minH, origin.current.sh + ev.clientY - origin.current.my),
      })
    }

    const up = () => {
      resizing.current = false
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [maximized, minH, minW, size])

  const toggleMaximize = useCallback((e) => {
    e.stopPropagation()
    if (!maximized) {
      preMaxState.current = { pos: { ...pos }, size: { ...size } }
      setMaximized(true)
    } else {
      if (preMaxState.current) {
        setPos(preMaxState.current.pos)
        setSize(preMaxState.current.size)
      }
      setMaximized(false)
    }
    onFocus?.(id)
  }, [id, maximized, onFocus, pos, size])

  const handleClose = useCallback((e) => {
    e.stopPropagation()
    setHidden(true)
    onClose?.(id)
  }, [id, onClose])

  if (hidden) return null

  const panelStyle = maximized
    ? { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: zIndex + 100 }
    : { position: 'absolute', left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex }

  return (
    <div
      style={{
        ...panelStyle,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        ...style,
      }}
      onMouseDown={() => onFocus?.(id)}
    >
      <div
        onMouseDown={onMouseDownDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          background: 'var(--panel2)',
          borderBottom: '1px solid var(--border)',
          cursor: maximized ? 'default' : 'move',
          flexShrink: 0,
          height: 28,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <div className="panel-no-drag" style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={toggleMaximize}
            title={maximized ? 'Restore' : 'Maximize'}
            style={{
              minWidth: 24,
              height: 18,
              border: '1px solid #555',
              borderRadius: 2,
              background: 'transparent',
              color: '#888',
              cursor: 'pointer',
              fontSize: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              fontFamily: 'var(--mono)',
              lineHeight: 1,
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#333' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {maximized ? 'RES' : 'MAX'}
          </button>
          <button
            onClick={handleClose}
            title="Close"
            style={{
              minWidth: 24,
              height: 18,
              border: '1px solid #555',
              borderRadius: 2,
              background: 'transparent',
              color: '#888',
              cursor: 'pointer',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              fontFamily: 'var(--mono)',
              lineHeight: 1,
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#c0392b'; e.currentTarget.style.color = '#fff' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
          >
            X
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>

      {!maximized && (
        <div
          onMouseDown={onMouseDownResize}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 14,
            height: 14,
            cursor: 'se-resize',
            background: 'linear-gradient(135deg, transparent 50%, var(--border) 50%)',
            opacity: 0.7,
          }}
        />
      )}
    </div>
  )
}
