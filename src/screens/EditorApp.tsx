import { useEffect, useRef, useState } from 'react'
import QuestionEditor from '../components/QuestionEditor'
import { deleteMediaIfUnused, saveGame } from '../db'
import {
  isEmptyQuestion,
  mediaIdsOf,
  moveCategory,
  newCategory,
  newQuestion,
  removeCategory,
  removeQuestion,
  sortByValue,
  updateCategory,
  updateQuestion,
  updateRound,
} from '../game'
import type { Category, Game, Question } from '../types'

// Подпись под номиналом в редакторе: видно, где пусто, а где уже есть картинка или музыка
function cellNote(question: Question): string | null {
  if (isEmptyQuestion(question)) return 'пусто'
  const kinds = { image: 'картинка', gif: 'GIF', video: 'видео', audio: 'музыка' }
  const media = question.slides.map((s) => s.media && kinds[s.media.type]).filter(Boolean)
  if (media.length > 0) return media.join(' + ')
  const count = question.slides.length
  return count > 1 ? `${count} ${count < 5 ? 'слайда' : 'слайдов'}` : null
}

// Редактор игры: название, категории строками, клик по ячейке открывает редактор вопроса.
// Правки сохраняются сами.
export default function EditorApp({ initialGame }: { initialGame: Game }) {
  const [game, setGame] = useState(initialGame)
  const [selectedId, setSelectedId] = useState<string | null>(null) // какой вопрос открыт
  const [saved, setSaved] = useState(true)
  const removedMedia = useRef<string[]>([]) // файлы, убранные из игры: удалим после сохранения

  // Автосохранение: после каждой правки кладём игру в хранилище
  useEffect(() => {
    if (game === initialGame) return // ничего ещё не меняли
    let cancelled = false
    saveGame(game).then(async () => {
      for (const id of removedMedia.current.splice(0)) await deleteMediaIfUnused(id)
      if (!cancelled) setSaved(true)
    })
    return () => {
      cancelled = true
    }
  }, [game, initialGame])

  function change(update: (g: Game) => Game) {
    setSaved(false)
    setGame(update)
  }

  const round = game.rounds[0]
  const category = round.categories.find((c) => c.questions.some((q) => q.id === selectedId))
  const question = category?.questions.find((q) => q.id === selectedId)

  function addCategory() {
    change((g) => updateRound(g, round.id, (r) => ({ ...r, categories: [...r.categories, newCategory()] })))
  }

  function deleteCategory(c: Category) {
    const filled = c.questions.filter((q) => !isEmptyQuestion(q)).length
    const warning = filled > 0 ? ` В ней ${filled} заполненных вопросов.` : ''
    if (!window.confirm(`Удалить категорию «${c.title}»?${warning} Это нельзя отменить.`)) return
    removedMedia.current.push(...c.questions.flatMap(mediaIdsOf))
    change((g) => removeCategory(g, c.id))
  }

  function addQuestion(c: Category) {
    const value = Math.max(0, ...c.questions.map((q) => q.value)) + 100
    const created = newQuestion(value)
    change((g) => updateCategory(g, c.id, (x) => ({ ...x, questions: [...x.questions, created] })))
    setSelectedId(created.id) // сразу открываем, чтобы заполнить
  }

  function deleteQuestion(q: Question) {
    if (!isEmptyQuestion(q) && !window.confirm(`Удалить вопрос за ${q.value}? Это нельзя отменить.`)) return
    removedMedia.current.push(...mediaIdsOf(q))
    change((g) => removeQuestion(g, q.id))
    setSelectedId(null)
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-10 py-8 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <a href="#/" className="text-sm text-muted hover:text-white">
            ← Мои игры
          </a>
          <span className="font-display text-xl">РЕДАКТОР</span>
          <input
            value={game.title}
            onChange={(e) => {
              const title = e.target.value
              change((g) => ({ ...g, title }))
            }}
            onBlur={() => {
              if (!game.title.trim()) change((g) => ({ ...g, title: 'Без названия' }))
            }}
            aria-label="Название игры"
            className="h-11 min-w-64 flex-1 rounded-lg border border-line bg-bg px-3 text-lg font-semibold text-white focus:border-white focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted" aria-live="polite">
            {saved ? 'Все изменения сохранены' : 'Сохраняю…'}
          </span>
          <a
            href={`#/play/${encodeURIComponent(game.id)}`}
            className="flex h-11 items-center rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90"
          >
            Играть
          </a>
        </div>
      </header>

      {category && question ? (
        <QuestionEditor
          key={question.id}
          categoryTitle={category.title}
          question={question}
          onChange={(update) => change((g) => updateQuestion(g, question.id, update))}
          onMediaRemoved={(id) => removedMedia.current.push(id)}
          onDelete={() => deleteQuestion(question)}
          otherValues={category.questions.filter((q) => q.id !== question.id).map((q) => q.value)}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <>
          <p className="text-muted">
            Нажмите на ячейку, чтобы изменить вопрос: текст, слайды, картинку или музыку. Название категории меняется прямо
            в строке.
          </p>

          <div className="flex flex-col gap-3">
            {round.categories.map((c, i) => (
              <CategoryRow
                key={c.id}
                category={c}
                isFirst={i === 0}
                isLast={i === round.categories.length - 1}
                onRename={(title) => change((g) => updateCategory(g, c.id, (x) => ({ ...x, title })))}
                onMove={(delta) => change((g) => moveCategory(g, c.id, delta))}
                onDelete={() => deleteCategory(c)}
                onOpenQuestion={setSelectedId}
                onAddQuestion={() => addQuestion(c)}
              />
            ))}
            {round.categories.length === 0 && <p className="text-muted">В игре пока нет ни одной категории.</p>}
          </div>

          <button
            type="button"
            onClick={addCategory}
            className="h-11 self-start rounded-lg border border-white px-5 font-semibold hover:bg-white hover:text-black"
          >
            + Добавить категорию
          </button>
        </>
      )}
    </div>
  )
}

// Строка категории: порядок, название, ячейки вопросов, «+ вопрос», удаление
function CategoryRow({ category, isFirst, isLast, onRename, onMove, onDelete, onOpenQuestion, onAddQuestion }: {
  category: Category
  isFirst: boolean
  isLast: boolean
  onRename: (title: string) => void
  onMove: (delta: number) => void
  onDelete: () => void
  onOpenQuestion: (questionId: string) => void
  onAddQuestion: () => void
}) {
  const rowButton = 'h-11 min-w-11 rounded-lg border border-line px-3 text-sm hover:bg-cell disabled:opacity-40'

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line p-3">
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label={`Поднять категорию «${category.title}» выше`} className={rowButton}>
          ↑
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label={`Опустить категорию «${category.title}» ниже`} className={rowButton}>
          ↓
        </button>
      </div>

      <input
        value={category.title}
        onChange={(e) => onRename(e.target.value)}
        onBlur={() => {
          if (!category.title.trim()) onRename('Без названия')
        }}
        aria-label="Название категории"
        className="h-20 w-52 rounded-xl border border-transparent bg-cell px-4 font-display text-lg text-white hover:border-line focus:border-white focus:outline-none"
      />

      {sortByValue(category.questions).map((q) => {
        const note = cellNote(q)
        const empty = note === 'пусто'
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onOpenQuestion(q.id)}
            className={`flex min-h-20 w-28 flex-col items-center justify-center rounded-xl border-2 font-display text-3xl transition hover:bg-white hover:text-black ${empty ? 'border-dashed border-muted text-muted' : 'border-white'}`}
          >
            {q.value}
            {note && <span className="font-sans text-sm font-normal">{note}</span>}
          </button>
        )
      })}

      <button
        type="button"
        onClick={onAddQuestion}
        aria-label={`Добавить вопрос в категорию «${category.title}»`}
        className="flex min-h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-line text-3xl text-muted hover:border-white hover:text-white"
      >
        +
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Удалить категорию «${category.title}»`}
        className={`ml-auto ${rowButton}`}
      >
        Удалить
      </button>
    </div>
  )
}
