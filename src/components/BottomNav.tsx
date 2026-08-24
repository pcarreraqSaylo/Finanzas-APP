import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/transactions', label: 'Movs', icon: 'movimientos', end: false },
  { to: '/analytics', label: 'Stats', icon: 'stats', end: false },
  { to: '/categories', label: 'Categorías', icon: 'administrativo', end: false }, // TODO: placeholder icon — no dedicated "categories" glyph exists yet
  { to: '/settings', label: 'Ajustes', icon: 'ajustes', end: false },
]

export function BottomNav({ onHomeClick }: { onHomeClick?: () => void }) {
  return (
    <nav className="sticky bottom-0 z-10 flex justify-around rounded-t-app border-t border-ink/10 bg-surface py-2 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      {TABS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={to === '/' ? onHomeClick : undefined}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 text-[11px] ${isActive ? 'text-teal' : 'text-ink-soft opacity-60'}`
          }
        >
          <img src={`/icons/${icon}.png`} alt="" className="h-6 w-6 object-contain" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
