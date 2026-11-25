import { useEffect, useRef, useState } from 'react'
import { describeClip, formatClipTime, parseClipTime, withClip } from '../clip'
import type { Clip, MediaRef } from '../types'
import { useMediaUrl } from '../useMediaUrl'

// Музыка или видео в редакторе: плеер и «Играть фрагмент: с … до …».
// Проще всего так: включить плеер, остановить на нужном месте и нажать «Начало — отсюда».

type Props = { media: MediaRef; className?: string; onChange: (media: MediaRef) => void }

export default function ClipEditor({ media, className = '', onChange }: Props) {
  const file = useMediaUrl(media)
  const ref = useRef<HTMLAudioElement & HTMLVideoElement>(null)
  const clip = media.clip
  const [playingClip, setPlayingClip] = useState(false)

  // «Проиграть фрагмент»: с начала фрагмента до его конца
  useEffect(() => {
    const el = ref.current
    if (!el || !playingClip) return
    const end = clip?.end
    const onTime = () => {
      if (end !== undefined && el.currentTime >= end) {
        el.pause()
        setPlayingClip(false)
      }
    }
    const onPause = () => setPlayingClip(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('pause', onPause)
    }
  }, [playingClip, clip?.end])

  if (file.status === 'loading') return <div className={`text-muted ${className}`}>Загрузка файла…</div>
  if (file.status === 'missing') return <div className={`text-muted ${className}`}>Файл «{media.name}» не найден в этом браузере</div>

  const change = (patch: Clip) => onChange(withClip(media, { ...clip, ...patch }))
  const now = () => Math.round((ref.current?.currentTime ?? 0) * 10) / 10

  function playClip() {
    const el = ref.current
    if (!el) return
    el.currentTime = clip?.start ?? 0
    setPlayingClip(true)
    void el.play().catch(() => setPlayingClip(false))
  }

  const described = describeClip(clip)
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {media.type === 'video' ? (
        <video ref={ref} src={file.url} controls className="max-h-64 self-start rounded-lg" />
      ) : (
        <audio ref={ref} src={file.url} controls className="w-full" />
      )}
      <span className="text-sm text-muted">{media.name}</span>
      <div role="group" aria-label="Фрагмент" className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
        <span className="text-muted">Играть:</span>
        <TimeField label="с" value={clip?.start} placeholder="начала" onChange={(start) => change({ start })} />
        <button type="button" onClick={() => change({ start: now() })} className="h-11 rounded-lg border border-line px-3 hover:bg-cell" title="Начало фрагмента — там, где сейчас стоит плеер">
          ⏱ отсюда
        </button>
        <TimeField label="до" value={clip?.end} placeholder="конца" onChange={(end) => change({ end })} />
        <button type="button" onClick={() => change({ end: now() })} className="h-11 rounded-lg border border-line px-3 hover:bg-cell" title="Конец фрагмента — там, где сейчас стоит плеер">
          ⏱ досюда
        </button>
        {described && (
          <>
            <button type="button" onClick={playClip} className="h-11 rounded-lg bg-white px-3 font-semibold text-black hover:opacity-90">
              ▶ Проиграть фрагмент
            </button>
            <button type="button" onClick={() => onChange(withClip(media, undefined))} className="h-11 rounded-lg border border-line px-3 hover:bg-cell">
              Весь файл
            </button>
          </>
        )}
        <span className="basis-full text-muted">
          {described
            ? `На пульте и в зале будет играть только фрагмент ${described}.`
            : 'Можно играть не весь файл, а кусок — например, для «угадай мелодию». Включите плеер, остановите на нужном месте и нажмите «⏱ отсюда».'}
        </span>
      </div>
    </div>
  )
}

// Поле времени «1:05»: правится как текст, сохраняется, когда ушли из поля или нажали Enter
function TimeField({ label, value, placeholder, onChange }: {
  label: string
  value: number | undefined
  placeholder: string
  onChange: (sec: number | undefined) => void
}) {
  const shown = value !== undefined ? formatClipTime(value) : ''
  const [draft, setDraft] = useState<string | null>(null) // пока печатают — свой текст
  const bad = draft !== null && draft.trim() !== '' && parseClipTime(draft) === null

  function save() {
    if (draft === null) return
    const sec = parseClipTime(draft)
    if (draft.trim() === '') onChange(undefined) // стёрли — с начала / до конца
    else if (sec !== null) onChange(sec) // непонятное время — просто вернём прежнее
    setDraft(null)
  }

  return (
    <label className="flex items-center gap-1">
      {label}
      <input
        value={draft ?? shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder={placeholder}
        aria-label={`${label === 'с' ? 'Начало' : 'Конец'} фрагмента, минуты:секунды`}
        aria-invalid={bad}
        inputMode="decimal"
        className={`h-11 w-20 rounded-lg border bg-bg px-2 text-center tabular-nums text-white focus:border-white focus:outline-none ${bad ? 'border-white' : 'border-line'}`}
      />
    </label>
  )
}
