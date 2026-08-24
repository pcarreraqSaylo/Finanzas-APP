import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home } from '../pages/Home'
import { Transactions } from '../pages/Transactions'
import { Analytics } from '../pages/Analytics'
import { Categories } from '../pages/Categories'
import { Settings } from '../pages/Settings'

const TAB_ORDER = [
  { path: '/', Component: Home },
  { path: '/transactions', Component: Transactions },
  { path: '/analytics', Component: Analytics },
  { path: '/categories', Component: Categories },
  { path: '/settings', Component: Settings },
]

const THRESHOLD_RATIO = 0.3
const SNAP_MS = 220
const MOVE_LOCK_PX = 8

export function SwipeableTabs({ homeResetKey }: { homeResetKey?: number }) {
  const location = useLocation()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    startX: number
    startY: number
    active: boolean
    locked: 'x' | 'y' | null
    pointerId: number | null
  }>({ startX: 0, startY: 0, active: false, locked: null, pointerId: null })

  const [dragX, setDragX] = useState(0)
  const [animating, setAnimating] = useState(false)

  const currentIndex = Math.max(
    0,
    TAB_ORDER.findIndex((t) => t.path === location.pathname),
  )

  function neighborIndex(dx: number) {
    if (dx < 0) return currentIndex + 1 < TAB_ORDER.length ? currentIndex + 1 : null
    if (dx > 0) return currentIndex - 1 >= 0 ? currentIndex - 1 : null
    return null
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (animating) return
    drag.current = { startX: e.clientX, startY: e.clientY, active: true, locked: null, pointerId: e.pointerId }
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY

    if (d.locked === null) {
      if (Math.abs(dx) < MOVE_LOCK_PX && Math.abs(dy) < MOVE_LOCK_PX) return
      d.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.locked === 'x' && d.pointerId !== null) {
        ;(e.target as Element).setPointerCapture?.(d.pointerId)
      }
    }
    if (d.locked !== 'x') return

    const width = containerRef.current?.clientWidth || 1
    const hasNeighbor = neighborIndex(dx) !== null
    // Rubber-band a little at the very first/last tab instead of dragging freely into nothing.
    const clamped = hasNeighbor ? Math.max(-width, Math.min(width, dx)) : dx * 0.25
    setDragX(clamped)
    e.preventDefault()
  }

  function endDrag() {
    const d = drag.current
    const wasDraggingX = d.active && d.locked === 'x'
    d.active = false
    d.locked = null
    if (!wasDraggingX) return

    const width = containerRef.current?.clientWidth || 1
    const neighbor = neighborIndex(dragX)
    const passedThreshold = neighbor !== null && Math.abs(dragX) > width * THRESHOLD_RATIO

    setAnimating(true)
    if (passedThreshold && neighbor !== null) {
      const target = dragX < 0 ? -width : width
      const targetPath = TAB_ORDER[neighbor].path
      setDragX(target)
      setTimeout(() => {
        navigate(targetPath)
        setDragX(0)
        setAnimating(false)
      }, SNAP_MS)
    } else {
      setDragX(0)
      setTimeout(() => setAnimating(false), SNAP_MS)
    }
  }

  function onPointerCancel() {
    drag.current.active = false
    drag.current.locked = null
    setDragX(0)
  }

  const width = containerRef.current?.clientWidth || 0
  const neighbor = neighborIndex(dragX)
  const NeighborTab = neighbor !== null ? TAB_ORDER[neighbor] : null
  const CurrentTab = TAB_ORDER[currentIndex]

  const transitionStyle = animating ? `transform ${SNAP_MS}ms ease-out` : 'none'
  const neighborBaseOffset = dragX < 0 ? width : -width

  function renderTab(tab: (typeof TAB_ORDER)[number]) {
    if (tab.path === '/') return <Home resetKey={homeResetKey} />
    const Component = tab.Component
    return <Component />
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex min-h-0 flex-1 overflow-hidden ${dragX !== 0 || animating ? 'select-none' : ''}`}
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="absolute inset-0 flex flex-col overflow-x-hidden overflow-y-auto"
        style={{ transform: `translateX(${dragX}px)`, transition: transitionStyle }}
      >
        {renderTab(CurrentTab)}
      </div>

      {NeighborTab && (
        <div
          className="absolute inset-0 flex flex-col overflow-x-hidden overflow-y-auto"
          style={{ transform: `translateX(${dragX + neighborBaseOffset}px)`, transition: transitionStyle }}
        >
          {renderTab(NeighborTab)}
        </div>
      )}
    </div>
  )
}
