import { Fragment } from 'react'
import { sortByValue } from '../game'
import type { Round } from '../types'

type Props = {
  round: Round
  interactive?: boolean // false — экран зала: ячейки не нажимаются
  onCellClick?: (categoryId: string, questionId: string) => void
}

// Табло: категории строками, номиналы справа от названия категории.
export default function Board({ round, interactive = true, onCellClick }: Props) {
  // Ячейки стоят по порядку, а не по цене: в строке могут быть и 100…800, и восемь «400».
  // Колонок столько, сколько вопросов в самой длинной категории.
  const columns = Math.max(0, ...round.categories.map((c) => c.questions.length))
  const positions = Array.from({ length: columns }, (_, i) => i)

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `minmax(180px, 1.6fr) repeat(${columns}, minmax(0, 1fr))` }}
    >
      {round.categories.map((category) => (
        <Fragment key={category.id}>
          {/* Длинное название («ФРАЗЕОЛОГИЗМЫ») уменьшается под ячейку и при нужде переносится с дефисом */}
          <div className="@container flex min-h-20 items-center rounded-xl bg-cell px-4 font-display">
            <span className="text-[min(1.125rem,8.5cqw)] hyphens-auto [overflow-wrap:anywhere]">
              {category.title.toUpperCase()}
            </span>
          </div>

          {positions.map((i) => {
            const question = sortByValue(category.questions)[i]

            // Сыгранный или отсутствующий вопрос — пустая пунктирная ячейка
            if (!question || question.played || question.hidden) {
              return <div key={i} className="min-h-20 rounded-xl border-2 border-dashed border-line" />
            }
            const value = question.value

            // @container + cqw: номинал уменьшается под ширину ячейки — «1000» помещается и при 10 колонках
            const cellClass =
              '@container flex min-h-20 items-center justify-center rounded-xl border-2 border-white font-display'
            const label = <span className="text-[min(1.875rem,20cqw)]">{value}</span>

            if (!interactive) {
              return (
                <div key={question.id} className={cellClass}>
                  {label}
                </div>
              )
            }

            return (
              <button
                key={question.id}
                type="button"
                onClick={() => onCellClick?.(category.id, question.id)}
                className={`${cellClass} transition hover:bg-white hover:text-black`}
              >
                {label}
              </button>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
