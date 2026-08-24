import { CATEGORY_ICON_SLUGS } from '../db/categoryIcons'

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

const SIZE_PX = { xs: 26, sm: 40, md: 53, lg: 77 } as const
const TEXT_CLASS = { xs: 'text-[10px]', sm: 'text-xs', md: 'text-base', lg: 'text-xl' } as const
const PAD_PX = { xs: 4, sm: 6, md: 8, lg: 14 } as const

export function CategoryBadge({
  name,
  size = 'md',
}: {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const dim = SIZE_PX[size]
  const slug = CATEGORY_ICON_SLUGS[name]

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-tint ring-1 ring-teal/30"
      style={{ width: dim, height: dim, padding: PAD_PX[size] }}
    >
      {slug ? (
        <img src={`/icons/${slug}.png`} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className={`font-display font-semibold text-ink ${TEXT_CLASS[size]}`}>{initials(name)}</span>
      )}
    </span>
  )
}
