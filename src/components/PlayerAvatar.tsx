import type { Player } from '../types'
import { useMediaUrl } from '../useMediaUrl'

// Инициалы: первые буквы первых двух слов имени («Анна Ковалёва» → «АК»)
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  )
}

// Круглое фото участника; без фото — инициалы
export default function PlayerAvatar({ player, size }: { player: Player; size: number }) {
  const file = useMediaUrl(player.photo)
  const style = { width: size, height: size, fontSize: Math.round(size / 3.5) }

  if (player.photo && file.status === 'ready') {
    return <img src={file.url} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-cell font-semibold"
    >
      {initials(player.name)}
    </span>
  )
}
