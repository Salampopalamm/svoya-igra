import type { ReactNode } from 'react'
import { sortByValue } from '../game'
import { itemGrow } from '../theme'
import { Resizable } from './Resizable'
import type { Round } from '../types'

type Props = {
  round: Round
  interactive?: boolean // false — экран зала: ячейки не нажимаются
  onCellClick?: (categoryId: string, questionId: string) => void
  unlockedIds?: string[] // скрытые вопросы, которые уже открыли (деревом или ведущим)
  onLockedClick?: (categoryId: string, questionId: string) => void // пульт: ведущий нажал скрытую ячейку
  onPlayedClick?: (categoryId: string, questionId: string) => void // пульт: ведущий нажал сыгранную ячейку
  onHallClick?: (categoryId: string, questionId: string) => void // зал с «Мышь в зале»: нажали обычную ячейку
}

// Табло: категории строками, номиналы справа от названия категории.
// Каждую ячейку и категорию в зале можно растянуть отдельно (режим «Растянуть в зале», Theme.itemSizes):
// растянутая шире в своей строке и крупнее целиком. Пока размеры обычные, столбцы ровные.
export default function Board({
  round,
  interactive = true,
  onCellClick,
  unlockedIds = [],
  onLockedClick,
  onPlayedClick,
  onHallClick,
}: Props) {
  // Ячейки стоят по порядку, а не по цене: в строке могут быть и 100…800, и восемь «400».
  // Колонок столько, сколько вопросов в самой длинной категории.
  const columns = Math.max(0, ...round.categories.map((c) => c.questions.length))
  const positions = Array.from({ length: columns }, (_, i) => i)

  return (
    <div className="flex flex-col gap-2.5">
      {round.categories.map((category) => (
        <div key={category.id} className="flex gap-2.5">
          {/* Длинное название («ФРАЗЕОЛОГИЗМЫ») уменьшается под ячейку и при нужде переносится с дефисом */}
          <Resizable
            item={`cat:${category.id}`}
            label={category.title}
            className="flex"
            style={{ ...itemGrow(`cat:${category.id}`, 1.6), minWidth: 180 }}
          >
            <div className="@container flex min-h-20 w-full items-center rounded-xl bg-cell px-4 font-display">
              <span className="text-[min(1.125rem,8.5cqw)] hyphens-auto [overflow-wrap:anywhere]">
                {category.title.toUpperCase()}
              </span>
            </div>
          </Resizable>

          {positions.map((i) => {
            const question = sortByValue(category.questions)[i]

            // Отсутствующий вопрос — пустая пунктирная ячейка
            if (!question) {
              return <div key={i} className="min-h-20 rounded-xl border-2 border-dashed border-line" style={{ flex: '1 1 0%', minWidth: 0 }} />
            }
            // Ячейка в своей рамке: в режиме «Растянуть» у неё уголок, растянутая — шире и крупнее
            const cell = (node: ReactNode) => (
              <Resizable
                key={question.id}
                item={`cell:${question.id}`}
                label={`${category.title} · ${question.value}`}
                className="flex"
                style={itemGrow(`cell:${question.id}`)}
              >
                {node}
              </Resizable>
            )

            // Сыгранный вопрос остаётся на табло красным; на пульте его можно открыть, чтобы показать ещё раз
            if (question.played) {
              const playedClass =
                '@container flex min-h-20 w-full items-center justify-center rounded-xl border-2 border-played bg-played/25 font-display text-white/70'
              const playedLabel = <span className="text-[min(1.875rem,20cqw)]">{question.value}</span>
              if (!interactive || !onPlayedClick) {
                return cell(
                  <div className={playedClass} aria-label={`${question.value} — сыгран`}>
                    {playedLabel}
                  </div>
                )
              }
              return cell(
                <button
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
              const lockedClass = '@container flex min-h-20 w-full flex-col items-center justify-center rounded-xl border-2 border-line bg-cell font-display'
              if (!interactive) {
                return cell(
                  <div className={lockedClass} aria-label="Скрытый вопрос">
                    <span className="text-[min(1.875rem,20cqw)] text-muted">?</span>
                  </div>
                )
              }
              return cell(
                <button
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
            const cellClass = `@container flex min-h-20 w-full items-center justify-center rounded-xl border-2 font-display ${justUnlocked ? 'border-accent bg-accent text-on-accent' : 'border-white'}`
            const label = <span className="text-[min(1.875rem,20cqw)]">{value}</span>

            if (!interactive) {
              // Зал, «Мышь в зале» включена: ячейку можно нажать прямо на проекторе
              if (onHallClick) {
                return cell(
                  <button
                    type="button"
                    onClick={() => onHallClick(category.id, question.id)}
                    className={`${cellClass} cursor-pointer transition hover:bg-accent hover:text-on-accent`}
                  >
                    {label}
                  </button>
                )
              }
              return cell(
                <div className={cellClass}>
                  {label}
                </div>
              )
            }

            return cell(
              <button
                type="button"
                onClick={() => onCellClick?.(category.id, question.id)}
                className={`${cellClass} transition hover:bg-white hover:text-black`}
              >
                {label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
