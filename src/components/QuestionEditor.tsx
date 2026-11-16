import { useState, type ReactNode } from 'react'
import { addMediaFile, MAX_FILE_MB } from '../db'
import type { Content, Question } from '../types'
import { MediaView } from './MediaView'

type Props = {
  categoryTitle: string
  question: Question
  // Изменить вопрос: получает текущий вопрос, возвращает новый
  onChange: (change: (q: Question) => Question) => void
  onMediaRemoved: (mediaId: string) => void // файл убрали из вопроса — его можно удалить из хранилища
  onDelete: () => void
  onClose: () => void
}

// Редактор вопроса: стоимость, слайды (текст и файл на каждом) и ответ. Сохраняется сам после каждой правки.
export default function QuestionEditor({
  categoryTitle,
  question,
  onChange,
  onMediaRemoved,
  onDelete,
  onClose,
}: Props) {
  const { slides } = question
  const [valueText, setValueText] = useState(String(question.value)) // что набрано в поле «Стоимость»

  function changeValue(text: string) {
    setValueText(text)
    const value = Number(text.trim())
    if (text.trim() !== '' && Number.isInteger(value) && value > 0) onChange((q) => ({ ...q, value }))
  }

  function changeSlide(index: number, change: (slide: Content) => Content) {
    onChange((q) => ({ ...q, slides: q.slides.map((s, i) => (i === index ? change(s) : s)) }))
  }

  function addSlide() {
    onChange((q) => ({ ...q, slides: [...q.slides, {}] }))
  }

  function removeSlide(index: number) {
    const media = slides[index]?.media
    onChange((q) => (q.slides.length > 1 ? { ...q, slides: q.slides.filter((_, i) => i !== index) } : q))
    if (media) onMediaRemoved(media.id)
  }

  // Поменять слайд местами с соседним: delta = -1 — выше, +1 — ниже
  function moveSlide(index: number, delta: number) {
    onChange((q) => {
      const target = index + delta
      if (target < 0 || target >= q.slides.length) return q
      const next = [...q.slides]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...q, slides: next }
    })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-cell p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-xl">{categoryTitle.toUpperCase()}</span>
          <label className="flex items-center gap-2 text-sm text-muted">
            Стоимость
            <input
              inputMode="numeric"
              value={valueText}
              onChange={(e) => changeValue(e.target.value)}
              onBlur={() => setValueText(String(question.value))} // неверное число — вернуть сохранённое
              className="h-11 w-28 rounded-lg border border-line bg-bg px-3 font-display text-xl text-white focus:border-white focus:outline-none"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onDelete} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-bg">
            Удалить вопрос
          </button>
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-white px-5 hover:bg-white hover:text-black">
            Готово
          </button>
        </div>
      </div>

      <p className="text-sm text-muted">
        Вопрос показывается слайдами по порядку. Обычно на первом — задание, на втором — картинка или музыка. Ведущий
        листает слайды стрелками ← / →. Всё сохраняется само.
      </p>

      {slides.map((slide, i) => (
        <section key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-bg p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-sm font-semibold tracking-widest text-muted">
              СЛАЙД {i + 1} ИЗ {slides.length}
            </h3>
            <SmallButton onClick={() => moveSlide(i, -1)} disabled={i === 0} label={`Поднять слайд ${i + 1} выше`}>
              ↑
            </SmallButton>
            <SmallButton
              onClick={() => moveSlide(i, 1)}
              disabled={i === slides.length - 1}
              label={`Опустить слайд ${i + 1} ниже`}
            >
              ↓
            </SmallButton>
            <SmallButton onClick={() => removeSlide(i)} disabled={slides.length === 1} label={`Удалить слайд ${i + 1}`}>
              Удалить слайд
            </SmallButton>
          </div>
          <ContentEditor
            content={slide}
            textLabel={`Текст слайда ${i + 1}`}
            placeholder={i === 0 ? 'Текст вопроса или описание задания' : 'Подпись к файлу (необязательно)'}
            onChange={(change) => changeSlide(i, change)}
            onMediaRemoved={onMediaRemoved}
          />
        </section>
      ))}

      <button
        type="button"
        onClick={addSlide}
        className="h-11 self-start rounded-lg border border-white px-5 font-semibold hover:bg-white hover:text-black"
      >
        + Добавить слайд
      </button>

      <section className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-muted p-4">
        <h3 className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ · ЗАЛ УВИДИТ ЕГО ПО КНОПКЕ ВЕДУЩЕГО</h3>
        <ContentEditor
          content={question.answer}
          textLabel="Текст ответа"
          placeholder="Правильный ответ"
          onChange={(change) => onChange((q) => ({ ...q, answer: change(q.answer) }))}
          onMediaRemoved={onMediaRemoved}
        />
      </section>
    </div>
  )
}

function SmallButton({ onClick, disabled, label, children }: {
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
function ContentEditor({ content, textLabel, placeholder, onChange, onMediaRemoved }: {
  content: Content
  textLabel: string
  placeholder: string
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
        placeholder={placeholder}
        rows={2}
        className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-lg text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
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
