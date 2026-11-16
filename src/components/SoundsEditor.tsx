import { useState } from 'react'
import { addMediaFile, deleteMediaIfUnused } from '../db'
import { playSound, type SoundKind } from '../sounds'
import type { MediaRef, Theme } from '../types'

type Sounds = Theme['sounds']

type Props = {
  sounds: Sounds
  onChange: (sounds: Sounds) => void
  onMediaRemoved: (mediaId: string) => void // свой файл убрали — его можно удалить из хранилища
}

// Сигналы игры: «верно», «неверно» (можно заменить своим файлом) и «время вышло». Включаются и на пульте.
export default function SoundsEditor({ sounds, onChange, onMediaRemoved }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-sm font-semibold tracking-widest text-muted">СИГНАЛЫ ИГРЫ · ИГРАЮТ НА ПУЛЬТЕ</h2>
        <label className="flex h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sounds.enabled}
            onChange={(e) => onChange({ ...sounds, enabled: e.target.checked })}
            className="h-5 w-5 accent-white"
          />
          Сигналы включены
        </label>
      </div>
      <SoundRow kind="correct" title="Верно" file={sounds.correct} sounds={sounds} onChange={onChange} onMediaRemoved={onMediaRemoved} />
      <SoundRow kind="wrong" title="Неверно" file={sounds.wrong} sounds={sounds} onChange={onChange} onMediaRemoved={onMediaRemoved} />
      <SoundRow kind="time-up" title="Время вышло" sounds={sounds} onChange={onChange} onMediaRemoved={onMediaRemoved} />
    </section>
  )
}

function SoundRow({ kind, title, file, sounds, onChange, onMediaRemoved }: {
  kind: SoundKind
  title: string
  file?: MediaRef
  sounds: Sounds
  onChange: (sounds: Sounds) => void
  onMediaRemoved: (mediaId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const replaceable = kind !== 'time-up'

  async function attach(picked: File | undefined) {
    if (!picked || kind === 'time-up') return
    setError(null)
    setBusy(true)
    try {
      const ref = await addMediaFile(picked)
      if (ref.type !== 'audio') {
        await deleteMediaIfUnused(ref.id) // не звук — файл сразу убираем из хранилища
        throw new Error('Нужен звуковой файл: mp3, wav или ogg.')
      }
      onChange({ ...sounds, [kind]: ref })
      if (file) onMediaRemoved(file.id) // старый файл заменили новым
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить файл.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    if (!file || kind === 'time-up') return
    onChange({ ...sounds, [kind]: undefined })
    onMediaRemoved(file.id)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-32 font-semibold">{title}</span>
      <span className="min-w-40 flex-1 text-sm text-muted">{file ? `свой: ${file.name}` : 'стандартный сигнал'}</span>
      <button
        type="button"
        onClick={() => void playSound(kind, sounds, true)}
        className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
      >
        ▶ Прослушать
      </button>
      {replaceable && (
        <label className="flex h-11 cursor-pointer items-center rounded-lg border border-line px-4 text-sm hover:bg-cell focus-within:border-white">
          {busy ? 'Сохраняю…' : file ? 'Заменить' : 'Свой звук…'}
          <input
            type="file"
            accept="audio/*"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void attach(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      )}
      {file && (
        <button type="button" onClick={reset} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
          Вернуть стандартный
        </button>
      )}
      {error && (
        <p role="alert" className="w-full rounded-lg border border-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
