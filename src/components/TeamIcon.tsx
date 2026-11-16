import type { Team } from '../types'
import { useMediaUrl } from '../useMediaUrl'

// Значок команды: своя картинка или эмодзи. Нет значка — ничего не показывает.
export default function TeamIcon({ team, size }: { team: Team; size: number }) {
  const file = useMediaUrl(team.logo)

  if (team.logo && file.status === 'ready') {
    return (
      <img
        src={file.url}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg object-cover"
      />
    )
  }
  if (!team.emoji) return null
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.75) }}
      className="flex shrink-0 items-center justify-center leading-none"
    >
      {team.emoji}
    </span>
  )
}
