import { DEFAULT_SIZES, hallSizes, SIZE_MAX, SIZE_MIN, SIZE_NAMES, SIZE_STEP } from '../theme'
import type { HallSizes, Theme } from '../types'

type Props = {
  theme: Theme
  onChange: (sizes: HallSizes) => void
}

// Ползунки размеров на экране зала: табло, команды, фото игроков, картинки вопросов (50–200%).
// Есть в оформлении игры (редактор, мастер) и в настройках пульта — там зал меняется сразу.
export default function SizeSliders({ theme, onChange }: Props) {
  const sizes = hallSizes(theme)
  const changed = SIZE_NAMES.some(({ id }) => sizes[id] !== 100)

  return (
    <div className="flex min-w-72 flex-1 flex-col gap-1">
      {SIZE_NAMES.map(({ id, name }) => (
        <label key={id} className="flex min-h-11 flex-wrap items-center gap-3 text-sm">
          <span className="w-36 shrink-0">{name}</span>
          <input
            type="range"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={SIZE_STEP}
            value={sizes[id]}
            onChange={(e) => onChange({ ...sizes, [id]: Number(e.target.value) })}
            className="h-11 w-40 accent-white"
          />
          <span className="w-12 tabular-nums">{sizes[id]}%</span>
        </label>
      ))}
      {changed && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_SIZES)}
          className="h-11 self-start rounded-lg border border-line px-4 text-sm hover:bg-cell"
        >
          Вернуть все по 100%
        </button>
      )}
    </div>
  )
}
