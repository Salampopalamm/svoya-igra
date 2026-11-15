import { useEffect, useState } from 'react'
import { getMedia } from '../db'
import type { Content, MediaRef } from '../types'

// Где показываем: на пульте музыка играет (там ведущий жмёт «play»),
// в зале вместо плеера — крупный значок. Звук идёт в колонки ноутбука или проектора
// одинаково, из какого бы окна он ни играл, а пульт браузер не заглушает.
// В редакторе всё можно посмотреть и послушать на месте.
export type MediaMode = 'host' | 'hall' | 'editor'

type Loaded = { id: string; url: string | null } // url = null — файла нет в хранилище

// Достаёт файл из хранилища и даёт временную ссылку на него для <img>, <audio>, <video>
function useMediaUrl(media: MediaRef | undefined) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const id = media?.id

  useEffect(() => {
    if (!id) return
    let cancelled = false
    let url: string | null = null
    getMedia(id).then((file) => {
      if (cancelled) return
      url = file ? URL.createObjectURL(file.blob) : null
      setLoaded({ id, url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url) // освобождаем память, когда файл больше не на экране
    }
  }, [id])

  if (!id || loaded?.id !== id) return { status: 'loading' as const }
  return loaded.url ? { status: 'ready' as const, url: loaded.url } : { status: 'missing' as const }
}

export function MediaView({ media, mode, className = '' }: { media: MediaRef; mode: MediaMode; className?: string }) {
  const file = useMediaUrl(media)

  if (file.status === 'loading') return <div className={`text-muted ${className}`}>Загрузка файла…</div>
  if (file.status === 'missing') {
    return <div className={`text-muted ${className}`}>Файл «{media.name}» не найден в этом браузере</div>
  }

  if (media.type === 'image' || media.type === 'gif') {
    return <img src={file.url} alt={media.name} className={`rounded-lg object-contain ${className}`} />
  }

  if (media.type === 'audio') {
    if (mode === 'editor') return <audio src={file.url} controls className={`w-full ${className}`} />
    if (mode === 'host') {
      return (
        <div className={`flex flex-col gap-2 ${className}`}>
          <span className="text-sm text-muted">♪ {media.name} — звук идёт из этого окна</span>
          <audio src={file.url} controls className="w-full" />
        </div>
      )
    }
    return (
      <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
        <span className="text-9xl">♪</span>
        <span className="text-3xl text-muted">Звучит музыка</span>
      </div>
    )
  }

  // Видео пока играет прямо в зале; управление с пульта — на этапе «Медиа и звук»
  if (mode === 'host') return <div className={`text-muted ${className}`}>Видео «{media.name}» показывается в зале</div>
  return <video src={file.url} controls className={`rounded-lg ${className}`} />
}

// Один слайд: текст и/или файл
export function SlideView({ slide, mode, textClass, mediaClass }: {
  slide: Content
  mode: MediaMode
  textClass: string // размер текста: в зале крупнее, на пульте мельче
  mediaClass: string // высота картинки
}) {
  return (
    <div className="flex flex-col gap-6">
      {slide.text && <p className={`leading-tight font-semibold ${textClass}`}>{slide.text}</p>}
      {slide.media && <MediaView media={slide.media} mode={mode} className={mediaClass} />}
    </div>
  )
}
