import { Fragment } from 'react'
import type { Round } from '../types'

type Props = {
  round: Round
  interactive?: boolean // false — экран зала: ячейки не нажимаются
  onCellClick?: (categoryId: string, questionId: string) => void
}

// Табло: категории строками, номиналы справа от названия категории.
export default function Board({ round, interactive = true, onCellClick }: Props) {
  // Все номиналы раунда по возрастанию — это колонки табло
  const values = [...new Set(round.categories.flatMap((c) => c.questions.map((q) => q.value)))].sort(
    (a, b) => a - b,
  )

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `minmax(180px, 1.6fr) repeat(${values.length}, minmax(0, 1fr))` }}
    >
      {round.categories.map((category) => (
        <Fragment key={category.id}>
          <div className="flex min-h-20 items-center rounded-xl bg-cell px-5 font-display text-lg">
            {category.title.toUpperCase()}
          </div>

          {values.map((value) => {
            const question = category.questions.find((q) => q.value === value)

            // Сыгранный или отсутствующий вопрос — пустая пунктирная ячейка
            if (!question || question.played || question.hidden) {
              return <div key={value} className="rounded-xl border-2 border-dashed border-line" />
            }

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
