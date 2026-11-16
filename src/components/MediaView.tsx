import { useRef } from 'react'
import type { Content, MediaRef } from '../types'
import { useMediaUrl } from '../useMediaUrl'
import { useFollowVideo, useVideoControl } from '../videoControl'

// Где показываем: на пульте музыка играет (там ведущий жмёт «play»),
// в зале вместо плеера — крупный значок. Звук идёт в колонки ноутбука или проектора
// одинаково, из какого бы окна он ни играл, а пульт браузер не заглушает.
// В редакторе всё можно посмотреть и послушать на месте.
export type MediaMode = 'host' | 'hall' | 'editor'

export function MediaView({ media, mode, className = '' }: { media: MediaRef; mode: MediaMode; className?: string }) {
  const file = useMediaUrl(media)

  if (file.status === 'loading') return <div className={`text-muted ${className}`}>Загрузка файла…</div>
  if (file.status === 'missing') {
    return <div className={`text-muted ${className}`}>Файл «{media.name}» не найден в этом браузере</div>
  }

  if (media.type === 'image' || media.type === 'gif') {
    return <img data-media src={file.url} alt={media.name} className={`rounded-lg object-contain ${className}`} />
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

  // Видео: в зале играет со звуком по команде ведущего, на пульте — копия без звука и кнопки
  if (mode === 'host') return <HostVideo media={media} url={file.url} className={className} />
  if (mode === 'hall') return <HallVideo media={media} url={file.url} className={className} />
  return <video src={file.url} controls className={`rounded-lg ${className}`} />
}

// Видео в зале: без кнопок, слушается пульта
function HallVideo({ media, url, className }: { media: MediaRef; url: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const { video, onBlocked } = useVideoControl()
  useFollowVideo(ref, video?.mediaId === media.id ? video : null, onBlocked)
  return <video data-media ref={ref} src={url} playsInline preload="auto" className={`rounded-lg ${className}`} />
}

// Видео на пульте: копия без звука (видно, что сейчас в зале) и управление залом
function HostVideo({ media, url, className }: { media: MediaRef; url: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const { video, send } = useVideoControl()
  const mine = video?.mediaId === media.id ? video : null
  const playing = mine?.playing ?? false
  const volume = mine?.volume ?? 1
  useFollowVideo(ref, mine)

  const now = () => ref.current?.currentTime ?? 0

  // Предпросмотр: управлять залом нельзя (предпросмотр в зал не попадает) — обычный плеер
  if (!send) return <video src={url} controls className={`rounded-lg ${className}`} />

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <video
        ref={ref}
        src={url}
        muted
        playsInline
        preload="auto"
        onEnded={() => send?.(media.id, { playing: false, time: now() })}
        className="min-h-0 flex-1 self-start rounded-lg object-contain"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => send?.(media.id, { playing: !playing, time: now() })}
          className={`h-11 rounded-lg px-4 font-semibold ${playing ? 'border border-white hover:bg-cell' : 'bg-white text-black hover:opacity-90'}`}
        >
          {playing ? '⏸ Пауза' : '▶ Видео в зале'}
        </button>
        <button
          type="button"
          onClick={() => send?.(media.id, { time: 0 })}
          className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
        >
          ⟲ С начала
        </button>
        <label className="flex h-11 items-center gap-2 text-sm text-muted">
          Громкость
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(volume * 100)}
            onChange={(e) => send?.(media.id, { volume: Number(e.target.value) / 100 })}
            className="w-32 accent-white"
          />
          <span className="w-10 tabular-nums">{Math.round(volume * 100)}%</span>
        </label>
      </div>
      <span className="text-sm text-muted">Звук видео идёт из окна зала, здесь — копия без звука</span>
    </div>
  )
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
