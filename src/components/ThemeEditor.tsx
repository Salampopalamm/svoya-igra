import { useState, type ReactNode } from 'react'
import { addMediaFile, deleteMediaIfUnused } from '../db'
import { ACCENT_PRESETS, FONTS, TONES } from '../theme'
import type { MediaRef, Theme } from '../types'
import { useMediaUrl } from '../useMediaUrl'
import SizeSliders from './SizeSliders'

type Props = {
  theme: Theme
  onChange: (patch: Partial<Theme>) => void
  onMediaRemoved: (mediaId: string) => void // картинку убрали — её можно удалить из хранилища
}

const ghostButton = 'h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell'

// Оформление экрана зала: фон, шрифт, фирменный цвет, логотип, фоновая картинка, «обесцветить медиа».
// Фон, шрифт и «обесцветить» ведущий может переключать и на пульте во время игры.
export default function ThemeEditor({ theme, onChange, onMediaRemoved }: Props) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line p-4">
      <h2 className="text-sm font-semibold tracking-widest text-muted">ОФОРМЛЕНИЕ ЭКРАНА ЗАЛА</h2>

      <Row title="Фон">
        {TONES.map((tone) => {
          const chosen = theme.backgroundTone === tone.id
          return (
            <button
              key={tone.id}
              type="button"
              onClick={() => onChange({ backgroundTone: tone.id })}
              aria-pressed={chosen}
              className={`flex h-11 items-center gap-2 rounded-lg px-3 text-sm ${chosen ? 'border-2 border-white' : 'border border-line hover:bg-cell'}`}
            >
              <span className="h-6 w-6 rounded-full border border-line" style={{ background: tone.bg }} />
              {tone.name}
            </button>
          )
        })}
      </Row>

      <Row title="Шрифт заголовков">
        {FONTS.map((f) => {
          const chosen = theme.headingFont === f.family
          return (
            <button
              key={f.family}
              type="button"
              onClick={() => onChange({ headingFont: f.family })}
              aria-pressed={chosen}
              title={`${f.family} — ${f.note}`}
              style={{ fontFamily: `"${f.family}", sans-serif` }}
              className={`h-11 rounded-lg px-3 text-base ${chosen ? 'bg-white text-black' : 'border border-line hover:bg-cell'}`}
            >
              ВОПРОС 400
            </button>
          )
        })}
      </Row>

      <Row title="Фирменный цвет">
        <button
          type="button"
          onClick={() => onChange({ accentColor: undefined })}
          aria-pressed={!theme.accentColor}
          className={`h-11 rounded-lg px-4 text-sm ${!theme.accentColor ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
        >
          Нет — строгий ч/б
        </button>
        {ACCENT_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ accentColor: color })}
            aria-pressed={theme.accentColor === color}
            aria-label={`Фирменный цвет ${color}`}
            className={`flex h-11 w-11 items-center justify-center rounded-lg ${theme.accentColor === color ? 'border-2 border-white' : 'border border-line hover:bg-cell'}`}
          >
            <span className="h-6 w-6 rounded-full" style={{ background: color }} />
          </button>
        ))}
        <label className={`${ghostButton} flex cursor-pointer items-center gap-2 focus-within:border-white`}>
          Свой цвет
          <input
            type="color"
            value={theme.accentColor ?? '#ffffff'}
            onChange={(e) => onChange({ accentColor: e.target.value.toUpperCase() })}
            className="h-7 w-9 cursor-pointer border-0 bg-transparent"
          />
        </label>
      </Row>
      <p className="-mt-3 text-sm text-muted">
        Фирменный цвет подсвечивает команду, чей ход или кто отвечает, и цену вопроса. Без него — белое на тёмном.
      </p>

      <Row title="Логотип">
        <ImagePicker
          image={theme.logo}
          label="логотип"
          onPick={(logo) => {
            if (theme.logo) onMediaRemoved(theme.logo.id)
            onChange({ logo })
          }}
        />
      </Row>
      <p className="-mt-3 text-sm text-muted">Логотип стоит в углу табло и на заставках зала.</p>

      <Row title="Фоновая картинка">
        <ImagePicker
          image={theme.background}
          label="фон"
          onPick={(background) => {
            if (theme.background) onMediaRemoved(theme.background.id)
            onChange({ background })
          }}
        />
      </Row>
      <p className="-mt-3 text-sm text-muted">Картинка ложится под табло, приглушённая цветом фона, чтобы текст читался.</p>

      <Row title="Медиа">
        <label className="flex h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={theme.grayscaleMedia}
            onChange={(e) => onChange({ grayscaleMedia: e.target.checked })}
            className="h-5 w-5 accent-white"
          />
          Обесцветить картинки и видео вопросов
        </label>
      </Row>

      <Row title="Размеры в зале">
        <SizeSliders theme={theme} onChange={onChange} />
      </Row>
      <p className="-mt-3 text-sm text-muted">
        Подгоните под проектор: крупнее табло, плашки команд, фото игроков или картинки вопросов. Во время игры то же
        есть на пульте в ⚙ — зал меняется сразу.
      </p>
    </section>
  )
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-44 shrink-0 font-semibold">{title}</span>
      {children}
    </div>
  )
}

// Картинка (логотип или фон): показать, загрузить, заменить, убрать
function ImagePicker({ image, label, onPick }: {
  image?: MediaRef
  label: string
  onPick: (image: MediaRef | undefined) => void
}) {
  const file = useMediaUrl(image)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(picked: File | undefined) {
    if (!picked) return
    setError(null)
    setBusy(true)
    try {
      const ref = await addMediaFile(picked)
      if (ref.type !== 'image' && ref.type !== 'gif') {
        await deleteMediaIfUnused(ref.id) // не картинка — сразу убираем из хранилища
        throw new Error('Нужна картинка: jpg, png, svg или gif.')
      }
      onPick(ref)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить картинку.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {image && file.status === 'ready' && (
        <img src={file.url} alt="" className="h-11 max-w-40 rounded border border-line object-contain" />
      )}
      <label className={`${ghostButton} flex cursor-pointer items-center focus-within:border-white`}>
        {busy ? 'Сохраняю…' : image ? 'Заменить' : `+ Загрузить ${label}`}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            void upload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {image && (
        <button type="button" onClick={() => onPick(undefined)} className={ghostButton}>
          Убрать
        </button>
      )}
      {error && (
        <p role="alert" className="w-full rounded-lg border border-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </>
  )
}
