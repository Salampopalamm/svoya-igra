import type { ReactNode } from 'react'
import { backgroundWithImage, hallThemeStyle } from '../theme'
import type { Theme } from '../types'
import { useMediaUrl } from '../useMediaUrl'

// Корень экрана зала: тон фона, шрифт, акцент, фоновая картинка и «обесцветить медиа» из оформления игры
export function HallFrame({ theme, className, children }: { theme: Theme; className: string; children: ReactNode }) {
  const background = useMediaUrl(theme.background)
  const style = hallThemeStyle(theme)
  if (theme.background && background.status === 'ready') style.background = backgroundWithImage(theme, background.url)

  return (
    <div data-hall style={style} className={`min-h-screen bg-bg text-white ${theme.grayscaleMedia ? 'gray-media' : ''} ${className}`}>
      {children}
    </div>
  )
}

// Логотип клиента; нет логотипа — ничего (или запасной текст)
export function GameLogo({ theme, className, fallback }: { theme: Theme; className: string; fallback?: ReactNode }) {
  const file = useMediaUrl(theme.logo)
  if (theme.logo && file.status === 'ready') return <img src={file.url} alt="Логотип" className={`object-contain ${className}`} />
  return <>{fallback ?? null}</>
}
