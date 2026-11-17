import { useState, type ReactNode } from 'react'
import { addMediaFile, MAX_FILE_MB } from '../db'
import type { Content } from '../types'
import { MediaView } from './MediaView'

// Общие части редакторов вопроса и дерева: поле «текст + файл» и маленькая кнопка.

export function SmallButton({ onClick, disabled, label, children }: {
  onClick: () => void
  disabled?: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-11 min-w-11 rounded-lg border border-line px-3 text-sm hover:bg-cell disabled:opacity-40"
    >
      {children}
    </button>
  )
}

// Текст + файл: один слайд или ответ. Файл можно выбрать кнопкой или перетащить мышкой.
export function ContentEditor({ content, textLabel, placeholder, warning, onChange, onMediaRemoved }: {
  content: Content
  textLabel: string
  placeholder: string
  warning?: string // недочёт: показывается вместо подсказки, заметнее
  onChange: (change: (c: Content) => Content) => void
  onMediaRemoved: (mediaId: string) => void
}) {
  const [busy, setBusy] = useState(false) // файл сейчас сохраняется
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const media = content.media

  async function attach(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const ref = await addMediaFile(file)
      onChange((c) => ({ ...c, media: ref }))
      if (media) onMediaRemoved(media.id) // старый файл заменили новым
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить файл.')
    } finally {
      setBusy(false)
    }
  }

  function detach() {
    if (!media) return
    onChange((c) => ({ text: c.text }))
    onMediaRemoved(media.id)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        void attach(e.dataTransfer.files[0])
      }}
      className={`flex flex-col gap-3 rounded-lg ${dragOver ? 'outline-2 outline-offset-4 outline-white outline-dashed' : ''}`}
    >
      <textarea
        value={content.text ?? ''}
        onChange={(e) => onChange((c) => ({ ...c, text: e.target.value || undefined }))}
        aria-label={textLabel}
        placeholder={warning ?? placeholder}
        rows={2}
        className={`w-full rounded-lg border bg-bg px-3 py-2 text-lg text-white focus:border-white focus:outline-none ${warning ? 'border-white placeholder:font-semibold placeholder:text-white' : 'border-line placeholder:text-muted/60'}`}
      />

      {media && (
        <div className="flex flex-col gap-2">
          <MediaView media={media} mode="editor" className="max-h-64 self-start" />
          <span className="text-sm text-muted">{media.name}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 cursor-pointer items-center rounded-lg border border-line px-4 text-sm hover:bg-cell focus-within:border-white">
          {busy ? 'Сохраняю файл…' : media ? 'Заменить файл' : '+ Картинка, музыка или видео'}
          <input
            type="file"
            accept="image/*,audio/*,video/*"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void attach(e.target.files?.[0])
              e.target.value = '' // чтобы можно было выбрать тот же файл ещё раз
            }}
          />
        </label>
        {media && (
          <button type="button" onClick={detach} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            Убрать файл
          </button>
        )}
        {!media && <span className="text-sm text-muted">или перетащите файл сюда · до {MAX_FILE_MB} МБ</span>}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
