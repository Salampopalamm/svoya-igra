import { Fragment } from 'react'
import type { Question, Round } from '../types'

type Props = {
  round: Round
  interactive?: boolean // false — экран зала: ячейки не нажимаются
  onCellClick?: (categoryId: string, questionId: string) => void
  cellNote?: (question: Question) => string | null // мелкая подпись под номиналом (в редакторе)
}

// Табло: категории строками, номиналы справа от названия категории.
export default function Board({ round, interactive = true, onCellClick, cellNote }: Props) {
  // Все номиналы раунда по возрастанию — это колонки табло
  const values = [...new Set(round.categories.flatMap((c) => c.questions.map((q) => q.value)))].sort(
    (a, b) => a - b,
  )

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `minmax(220px, 1.6fr) repeat(${values.length}, 1fr)` }}
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

            const note = cellNote?.(question)
            const cellClass ='flex min-h-20 items-center justify-center rounded-xl border-2 border-white font-display text-3xl'

            if (!interactive) {
              return (
                <div key={question.id} className={cellClass}>
                  {value}
                </div>
              )
            }

            return (
              <button
                key={question.id}
                type="button"
                onClick={() => onCellClick?.(category.id, question.id)}
                className={`${cellClass} flex-col transition hover:bg-white hover:text-black`}
              >
                {value}
                {note && <span className="font-sans text-sm font-normal">{note}</span>}
              </button>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
