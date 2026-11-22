import { Fragment } from 'react'
import { sortByValue } from '../game'
import type { Round } from '../types'

type Props = {
  round: Round
  interactive?: boolean // false — экран зала: ячейки не нажимаются
  onCellClick?: (categoryId: string, questionId: string) => void
  unlockedIds?: string[] // скрытые вопросы, которые уже открыли (деревом или ведущим)
  onLockedClick?: (categoryId: string, questionId: string) => void // пульт: ведущий нажал скрытую ячейку
  onPlayedClick?: (categoryId: string, questionId: string) => void // пульт: ведущий нажал сыгранную ячейку
}

// Табло: категории строками, номиналы справа от названия категории.
export default function Board({
  round,
  interactive = true,
  onCellClick,
  unlockedIds = [],
  onLockedClick,
  onPlayedClick,
}: Props) {
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

            // Отсутствующий вопрос — пустая пунктирная ячейка
            if (!question) {
              return <div key={i} className="min-h-20 rounded-xl border-2 border-dashed border-line" />
            }

            // Сыгранный вопрос остаётся на табло красным; на пульте его можно открыть, чтобы показать ещё раз
            if (question.played) {
              const playedClass =
                '@container flex min-h-20 items-center justify-center rounded-xl border-2 border-played bg-played/25 font-display text-white/70'
              const playedLabel = <span className="text-[min(1.875rem,20cqw)]">{question.value}</span>
              if (!interactive || !onPlayedClick) {
                return (
                  <div key={question.id} className={playedClass} aria-label={`${question.value} — сыгран`}>
                    {playedLabel}
                  </div>
                )
              }
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onPlayedClick(category.id, question.id)}
                  title="Уже сыгран — открыть только посмотреть (счёт не изменится)"
                  aria-label={`${question.value} — сыгран, открыть для показа`}
                  className={`${playedClass} transition hover:bg-played hover:text-white`}
                >
                  {playedLabel}
                </button>
              )
            }
            const value = question.value
            const locked = question.hidden && !unlockedIds.includes(question.id)
            const justUnlocked = question.hidden && !locked // открытый скрытый вопрос подсвечен акцентом

            // Скрытый вопрос: в зале — «?» без цены, на пульте — цена и «скрыт», ведущий может открыть
            if (locked) {
              const lockedClass = '@container flex min-h-20 flex-col items-center justify-center rounded-xl border-2 border-line bg-cell font-display'
              if (!interactive) {
                return (
                  <div key={question.id} className={lockedClass} aria-label="Скрытый вопрос">
                    <span className="text-[min(1.875rem,20cqw)] text-muted">?</span>
                  </div>
                )
              }
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onLockedClick?.(category.id, question.id)}
                  title="Скрытый вопрос: нажмите, чтобы открыть его"
                  className={`${lockedClass} text-muted transition hover:border-white hover:text-white`}
                >
                  <span className="text-[min(1.5rem,16cqw)]">{value}</span>
                  <span className="font-sans text-xs">🔒 скрыт</span>
                </button>
              )
            }

            // @container + cqw: номинал уменьшается под ширину ячейки — «1000» помещается и при 10 колонках
            const cellClass = `@container flex min-h-20 items-center justify-center rounded-xl border-2 font-display ${justUnlocked ? 'border-accent bg-accent text-on-accent' : 'border-white'}`
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
