import { useMemo, useState } from 'react'
import { inferVesselKind, resolveItemThumbnail, resolveThumbnailByName } from '../lib/thumbnails.ts'
import type { PantryItem } from '../types.ts'

export type ThumbSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_PX: Record<ThumbSize, number> = {
  xs: 20,
  sm: 28,
  md: 38,
  lg: 48,
}

interface ProductThumbProps {
  item?: Pick<PantryItem, 'id' | 'name' | 'barcode' | 'unit' | 'category'>
  name?: string
  imageUrl?: string | null
  size?: ThumbSize
  className?: string
}

function VesselIcon({ kind, px }: { kind: ReturnType<typeof inferVesselKind>; px: number }) {
  const s = px
  const stroke = '#E8E2D9'
  const fill = '#2B5B3F'
  const accent = '#E3EFE7'
  const vb = '0 0 48 48'
  let inner = ''
  switch (kind) {
    case 'jar':
      inner = `<rect x="14" y="15" width="20" height="24" rx="4" fill="${fill}"/><rect x="15" y="10" width="18" height="5" rx="2" fill="${accent}"/>`
      break
    case 'box':
      inner = `<rect x="12" y="14" width="24" height="22" rx="3" fill="${fill}"/><rect x="14" y="16" width="20" height="8" rx="1" fill="${accent}"/>`
      break
    case 'roll':
      inner = `<ellipse cx="24" cy="28" rx="14" ry="10" fill="${fill}"/><rect x="22" y="8" width="4" height="14" rx="1" fill="${accent}"/>`
      break
    case 'pack':
      inner = `<rect x="13" y="12" width="22" height="26" rx="4" fill="${fill}"/><rect x="16" y="16" width="16" height="10" rx="2" fill="${accent}"/>`
      break
    case 'spray':
      inner = `<rect x="20" y="6" width="8" height="8" rx="2" fill="${accent}"/><path d="M18 14h12l-2 24c0 2-2 4-4 4h-4c-2 0-4-2-4-4L18 14z" fill="${fill}"/>`
      break
    case 'stick':
      inner = `<rect x="19" y="14" width="10" height="24" rx="5" fill="${fill}"/><rect x="20" y="8" width="8" height="6" rx="2" fill="${accent}"/>`
      break
    case 'tub':
      inner = `<rect x="11" y="16" width="26" height="18" rx="6" fill="${fill}"/><ellipse cx="24" cy="34" rx="13" ry="6" fill="${fill}"/>`
      break
    default:
      inner = `<path d="M16 14h16v22c0 2-1.5 4-4 4H20c-2.5 0-4-2-4-4V14z" fill="${fill}"/><rect x="14" y="8" width="20" height="6" rx="2" fill="${accent}"/>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${s}" height="${s}"><rect width="48" height="48" rx="8" fill="#FFFFFF"/><rect x="0.5" y="0.5" width="47" height="47" rx="7.5" fill="none" stroke="${stroke}"/>${inner}</svg>`
  return (
    <img
      src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
      alt=""
      aria-hidden="true"
      className="product-thumb product-thumb-fallback"
      width={s}
      height={s}
    />
  )
}

export function ProductThumb({
  item,
  name,
  imageUrl,
  size = 'md',
  className,
}: ProductThumbProps) {
  const px = SIZE_PX[size]
  const [broken, setBroken] = useState(false)

  const src = useMemo(() => {
    if (imageUrl?.trim()) return imageUrl.trim()
    if (item) return resolveItemThumbnail(item)
    if (name) return resolveThumbnailByName(name)
    return null
  }, [imageUrl, item, name])

  const vessel = item ? inferVesselKind(item) : inferVesselKind({ name: name ?? '', unit: '', category: '' })

  if (!src || broken) {
    return (
      <span className={`product-thumb-wrap product-thumb-wrap--${size} ${className ?? ''}`}>
        <VesselIcon kind={vessel} px={px} />
      </span>
    )
  }

  return (
    <span className={`product-thumb-wrap product-thumb-wrap--${size} ${className ?? ''}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="product-thumb"
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    </span>
  )
}
