import { plural } from '../plural'
import type { HintState } from '../hints'
import type { Content } from '../types'
import { ContentMedia } from './MediaView'

// Подсказки на пульте: ведущий видит их все и по кнопке выводит в зал (всплывают поверх вопроса).
// Показывать — по порядку; уже показанную можно вывести снова бесплатно.
export default function HintsHost({ hints, hint, cost, onShow, onHide }: {
  hints: Content[]
  hint: HintState | null
  cost: number // сколько меньше за верный ответ после каждой подсказки (0 — бесплатно)
  onShow: (index: number) => void
  onHide: () => void
}) {
  const shown = hint?.shown ?? 0
  const open = hint?.open ?? null
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-sm font-semibold tracking-widest text-muted">
          💡 ПОДСКАЗКИ ДЛЯ ЗАЛА · {cost ? `каждая −${cost} за верный ответ` : 'бесплатно'}
        </div>
        {shown > 0 && (
          <span className="text-sm text-muted">
            показано {shown} {plural(shown, 'подсказка', 'подсказки', 'подсказок')}
            {cost ? ` · за верный ответ −${cost * shown}` : ''}
          </span>
        )}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(18rem, 100%), 1fr))' }}>
        {hints.map((h, i) => {
          const isOpen = open === i
          const wasShown = i < shown
          const next = i === shown
          return (
            <div key={i} className={`flex flex-col gap-2 rounded-lg p-3 ${isOpen ? 'border-2 border-white bg-cell' : 'border border-line'}`}>
              <div className="text-sm text-muted">
                Подсказка {i + 1}
                {isOpen ? ' · сейчас в зале' : wasShown ? ' · уже показана' : ''}
              </div>
              {h.text && <p className="text-lg whitespace-pre-line">{h.text}</p>}
              <ContentMedia content={h} mode="host" className="max-h-24" gridHeight="6rem" />
              {isOpen ? (
                <button type="button" onClick={onHide} className="mt-auto h-11 rounded-lg bg-white px-4 font-semibold text-black hover:opacity-90">
                  Убрать из зала
                </button>
              ) : wasShown || next ? (
                <button
                  type="button"
                  onClick={() => onShow(i)}
                  className="mt-auto h-11 rounded-lg border border-white px-4 hover:bg-white hover:text-black"
                >
                  {wasShown ? 'Показать снова' : `Показать в зале${cost ? ` · −${cost}` : ''}`}
                </button>
              ) : (
                <span className="mt-auto flex h-11 items-center text-sm text-muted">сначала — подсказка {i}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
