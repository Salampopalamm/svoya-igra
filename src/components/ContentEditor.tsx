import { useState, type ReactNode } from 'react'
import { addMediaFile, MAX_FILE_MB } from '../db'
import { canAddPicture, columnsOf, contentMedia, layoutName, layoutOf, layoutsFor, MAX_PICTURES, withoutPicture } from '../pictures'
import type { Content, MediaRef, PictureLayout } from '../types'
import { ContentMedia, MediaView } from './MediaView'

// Маленькая схема шаблона на кнопке: квадратики, как встанут картинки
function LayoutIcon({ layout, count }: { layout: PictureLayout; count: number }) {
  const box = 'rounded-[2px] bg-current opacity-70'
  if (layout === 'big-left') {
    return (
      <span aria-hidden className="grid h-6 w-9 gap-0.5" style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: `repeat(${count - 1}, 1fr)` }}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={box} style={i === 0 ? { gridRow: `1 / span ${count - 1}` } : undefined} />
        ))}
      </span>
    )
  }
  const cols = columnsOf(layout)
  const rows = Math.ceil(count / cols)
  return (
    <span aria-hidden className="flex h-6 w-9 flex-wrap content-center justify-center gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={box}
          style={{ width: `calc((100% - ${cols - 1} * 2px) / ${cols})`, height: `calc((100% - ${rows - 1} * 2px) / ${rows})` }}
        />
      ))}
    </span>
  )
}

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
export function ContentEditor({ content, textLabel, placeholder, warning, onChange, onMediaRemoved, onArrange }: {
  content: Content
  textLabel: string
  placeholder: string
  warning?: string // недочёт: показывается вместо подсказки, заметнее
  onChange: (change: (c: Content) => Content) => void
  onMediaRemoved: (mediaId: string) => void
  onArrange?: () => void // открыть предпросмотр и расставить текст и картинки самому
}) {
  const [busy, setBusy] = useState(false) // файл сейчас сохраняется
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const media = content.media
  const pictures = contentMedia(content)
  const canAdd = canAddPicture(content)

  // Поставить файл первым (заменить прежний). Если выбрали сразу несколько картинок — остальные встают рядом.
  async function attach(files: File[]) {
    if (files.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const [first, ...rest] = files
      if (content.more?.length && !first.type.startsWith('image/')) {
        throw new Error('На слайде несколько картинок — заменить первую можно только картинкой.')
      }
      const ref = await addMediaFile(first)
      const extra = ref.type === 'image' || ref.type === 'gif' ? await saveImages(rest, MAX_PICTURES - pictures.length) : []
      onChange((c) => ({ ...c, media: ref, ...(extra.length > 0 ? { more: [...(c.more ?? []), ...extra] } : {}) }))
      if (media) onMediaRemoved(media.id) // старый файл заменили новым
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить файл.')
    } finally {
      setBusy(false)
    }
  }

  // Ещё картинки рядом с первой
  async function addPictures(files: File[]) {
    if (files.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const refs = await saveImages(files, MAX_PICTURES - pictures.length)
      if (refs.length > 0) onChange((c) => ({ ...c, more: [...(c.more ?? []), ...refs] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить картинку.')
    } finally {
      setBusy(false)
    }
  }

  // Сохранить картинки в хранилище (не больше limit); не картинки — пропустить с объяснением
  async function saveImages(files: File[], limit: number): Promise<MediaRef[]> {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length < files.length) setError('На одном слайде рядом можно ставить только картинки — остальные файлы пропущены.')
    if (images.length > limit) setError(`На слайде помещается до ${MAX_PICTURES} картинок — лишние пропущены.`)
    const refs: MediaRef[] = []
    for (const file of images.slice(0, Math.max(0, limit))) refs.push(await addMediaFile(file))
    return refs
  }

  function detach() {
    if (!media) return
    onChange((c) => ({ text: c.text }))
    onMediaRemoved(media.id)
  }

  function removePicture(index: number) {
    const removed = pictures[index]
    onChange((c) => withoutPicture(c, index))
    if (removed) onMediaRemoved(removed.id)
  }

  // Переставить картинку на место левее (первая — большая в шаблоне «Большая + …»)
  function movePictureLeft(index: number) {
    onChange((c) => {
      const list = contentMedia(c)
      if (index <= 0 || index >= list.length) return c
      ;[list[index - 1], list[index]] = [list[index], list[index - 1]]
      const [first, ...more] = list
      return { ...c, media: first, more }
    })
  }

  // Перетащили файлы: к картинке — добавляем рядом, иначе — ставим первым
  function drop(files: File[]) {
    if (canAdd && files.every((f) => f.type.startsWith('image/'))) void addPictures(files)
    else void attach(files)
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
        drop([...e.dataTransfer.files])
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

      {media && pictures.length === 1 && (
        <div className="flex flex-col gap-2">
          <MediaView media={media} mode="editor" className="max-h-64 self-start" />
          <span className="text-sm text-muted">{media.name}</span>
        </div>
      )}

      {/* Несколько картинок: как они встанут в зале, шаблон и сами картинки (убрать, переставить) */}
      {pictures.length > 1 && (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <ContentMedia content={content} mode="editor" className="" gridHeight="16rem" />
          <div role="group" aria-label="Как расставить картинки" className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Расстановка:</span>
            {layoutsFor(pictures.length).map((layout) => {
              const chosen = layoutOf(content) === layout
              return (
                <button
                  key={layout}
                  type="button"
                  onClick={() => onChange((c) => ({ ...c, layout }))}
                  aria-pressed={chosen}
                  className={`flex h-11 items-center gap-2 rounded-lg px-3 text-sm ${chosen ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
                >
                  <LayoutIcon layout={layout} count={pictures.length} />
                  {layoutName(layout, pictures.length)}
                </button>
              )
            })}
          </div>
          <ol className="flex flex-wrap gap-2">
            {pictures.map((picture, i) => (
              <li key={`${picture.id}-${i}`} className="flex items-center gap-1 rounded-lg border border-line p-1 text-sm">
                <span className="w-5 text-center text-muted">{i + 1}</span>
                <span className="max-w-32 truncate" title={picture.name}>
                  {picture.name}
                </span>
                <SmallButton onClick={() => movePictureLeft(i)} disabled={i === 0} label={`Картинку ${i + 1} — на место левее`}>
                  ←
                </SmallButton>
                <SmallButton onClick={() => removePicture(i)} label={`Убрать картинку ${i + 1}`}>
                  ✕
                </SmallButton>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 cursor-pointer items-center rounded-lg border border-line px-4 text-sm hover:bg-cell focus-within:border-white">
          {busy ? 'Сохраняю файл…' : media ? (pictures.length > 1 ? 'Заменить первую' : 'Заменить файл') : '+ Картинка, музыка или видео'}
          <input
            type="file"
            accept="image/*,audio/*,video/*"
            multiple={!content.more?.length}
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void attach([...(e.target.files ?? [])])
              e.target.value = '' // чтобы можно было выбрать тот же файл ещё раз
            }}
          />
        </label>
        {canAdd && (
          <label className="flex h-11 cursor-pointer items-center rounded-lg border border-line px-4 text-sm hover:bg-cell focus-within:border-white">
            + Ещё картинка рядом
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                void addPictures([...(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
          </label>
        )}
        {media && pictures.length === 1 && (
          <button type="button" onClick={detach} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            Убрать файл
          </button>
        )}
        {onArrange && (content.text || media) && (
          <button type="button" onClick={onArrange} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            {content.place ? 'Расстановка: своя · изменить' : 'Расставить самому…'}
          </button>
        )}
        {content.place && (
          <button
            type="button"
            onClick={() => onChange((c) => {
              const next = { ...c }
              delete next.place
              return next
            })}
            title="Убрать свою расстановку — слайд разложится сам"
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            Вернуть авто
          </button>
        )}
        {!media && <span className="text-sm text-muted">или перетащите файл сюда · до {MAX_FILE_MB} МБ</span>}
        {canAdd && pictures.length === 1 && (
          <span className="text-sm text-muted">до {MAX_PICTURES} картинок на одном слайде</span>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
