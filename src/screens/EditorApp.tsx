import { useState } from 'react'
import HallPreview from '../components/HallPreview'
import QuestionEditor from '../components/QuestionEditor'
import ThemeEditor from '../components/ThemeEditor'
import RulesEditor from '../components/RulesEditor'
import { ruleProblem } from '../rules'
import { useSavedGame } from '../useSavedGame'
import {
  GRID_SIZES,
  gridSizeOf,
  isEmptyQuestion,
  MAX_QUESTIONS,
  mediaIdsOf,
  resizeRound,
  moveCategory,
  newCategory,
  newQuestion,
  removeCategory,
  removeQuestion,
  removeRound,
  addRound,
  gameProblems,
  hiddenQuestions,
  questionProblem,
  roundById,
  sortByValue,
  updateCategory,
  updateQuestion,
  updateRound,
} from '../game'
import type { GameProblem } from '../game'
import { plural } from '../plural'
import type { Category, Game, Question } from '../types'

// Подпись под номиналом в редакторе: видно, где пусто, а где уже есть картинка или музыка
function cellNote(question: Question): string | null {
  const note = baseNote(question)
  return question.hidden ? `🔒 скрыт${note ? ` · ${note}` : ''}` : note
}

function baseNote(question: Question): string | null {
  if (isEmptyQuestion(question)) return 'пусто'
  const problem = questionProblem(question)
  if (problem === 'no-answer') return '⚠ нет ответа'
  if (problem === 'no-question') return '⚠ нет вопроса'
  if (problem === 'tree') return '⚠ дерево'
  if (question.tree) {
    const steps = question.tree.nodes.length
    return `дерево · ${steps} ${plural(steps, 'шаг', 'шага', 'шагов')}`
  }
  const kinds = { image: 'картинка', gif: 'GIF', video: 'видео', audio: 'музыка' }
  const media = question.slides.map((s) => s.media && kinds[s.media.type]).filter(Boolean)
  if (media.length > 0) return media.join(' + ')
  const count = question.slides.length
  return count > 1 ? `${count} ${count < 5 ? 'слайда' : 'слайдов'}` : null
}

// Редактор игры: название, категории строками, клик по ячейке открывает редактор вопроса.
// Правки сохраняются сами.
export default function EditorApp({ initialGame }: { initialGame: Game }) {
  const { game, change, saved, dropMedia } = useSavedGame(initialGame)
  const [selectedId, setSelectedId] = useState<string | null>(null) // какой вопрос открыт
  const [roundId, setRoundId] = useState<string | null>(initialGame.rounds[0]?.id ?? null) // какой раунд открыт
  const [previewing, setPreviewing] = useState(false) // открыт предпросмотр вопроса «как в зале»

  const round = roundById(game, roundId)
  const isFinal = round.kind === 'final' // финал: каждая категория — тема с одним вопросом
  // Недочёты игры и правил: правило без цели — тоже недочёт
  const problems: GameProblem[] = [
    ...gameProblems(game),
    ...game.rules.flatMap((r, i) => {
      const problem = ruleProblem(game, r)
      return problem ? [{ text: `правило ${i + 1}: ${problem}` }] : []
    }),
  ]

  // Перейти к недочёту: открыть его раунд и, если есть, сам вопрос
  function showProblem(problem: GameProblem) {
    if (!problem.roundId) {
      setSelectedId(null)
      document.getElementById('rules')?.scrollIntoView({ behavior: 'smooth' }) // недочёт в правилах
      return
    }
    setRoundId(problem.roundId)
    setSelectedId(problem.questionId ?? null)
  }

  function newRound() {
    const { game: next, round: created } = addRound(game)
    change(() => next)
    setRoundId(created.id)
  }

  function deleteRound() {
    const filled = round.categories.flatMap((c) => c.questions).filter((q) => !isEmptyQuestion(q)).length
    const warning = filled > 0 ? ` В нём ${filled} заполненных вопросов.` : ''
    if (!window.confirm(`Удалить «${round.title}»?${warning} Это нельзя отменить.`)) return
    dropMedia(...round.categories.flatMap((c) => c.questions).flatMap(mediaIdsOf))
    change((g) => removeRound(g, round.id))
    setRoundId(null) // откроется первый раунд
  }
  const category = round.categories.find((c) => c.questions.some((q) => q.id === selectedId))
  const question = category?.questions.find((q) => q.id === selectedId)

  // Тип раунда: обычный или финал. В финале у каждой темы один вопрос — лишние убираем (с подтверждением).
  function setRoundKind(kind: 'standard' | 'final') {
    if (kind === round.kind) return
    if (kind === 'final') {
      const { removed } = resizeRound(round, 1)
      const filled = removed.filter((q) => !isEmptyQuestion(q))
      if (filled.length > 0) {
        const ok = window.confirm(
          `В финале у каждой темы один вопрос (самый дешёвый в категории). Остальные заполненные вопросы (${filled.length}) удалятся. Это нельзя отменить. Продолжить?`,
        )
        if (!ok) return
      }
      dropMedia(...removed.flatMap(mediaIdsOf))
      change((g) => updateRound(g, round.id, (r) => ({ ...resizeRound(r, 1).round, kind: 'final' })))
    } else {
      change((g) => updateRound(g, round.id, (r) => ({ ...r, kind: 'standard' })))
    }
  }

  function addCategory() {
    // В финале — тема с одним вопросом; иначе столько же вопросов, сколько в остальных категориях (в пустой игре — 10)
    const size = isFinal ? 1 : gridSizeOf(round)
    change((g) => updateRound(g, round.id, (r) => ({ ...r, categories: [...r.categories, newCategory(size)] })))
  }

  // Готовая сетка: все категории раунда — по size вопросов
  function applyGrid(size: number) {
    const { removed } = resizeRound(round, size)
    const filled = removed.filter((q) => !isEmptyQuestion(q))
    if (filled.length > 0) {
      const list = filled.map((q) => q.value).join(', ')
      const ok = window.confirm(
        `В сетке на ${size} не поместятся заполненные вопросы (${filled.length}: за ${list}). Удалить их? Это нельзя отменить.`,
      )
      if (!ok) return
    }
    dropMedia(...removed.flatMap(mediaIdsOf))
    change((g) => updateRound(g, round.id, (r) => resizeRound(r, size).round))
  }

  // Какая сетка сейчас: если во всех категориях поровну вопросов — это число
  const counts = new Set(round.categories.map((c) => c.questions.length))
  const currentGrid = counts.size === 1 ? [...counts][0] : null

  // Сколько колонок у ячеек в строке категории (одинаково для всех строк, чтобы номиналы стояли ровно).
  // До 6 ячеек (с «+») — одна строка, больше — две строки, иначе 10 ячеек не влезут в ноутбук.
  const maxInCategory = isFinal ? 1 : MAX_QUESTIONS
  const cells = Math.max(1, ...round.categories.map((c) => c.questions.length + (c.questions.length < maxInCategory ? 1 : 0)))
  const columns = cells <= 6 ? cells : Math.ceil(cells / 2)

  function deleteCategory(c: Category) {
    const filled = c.questions.filter((q) => !isEmptyQuestion(q)).length
    const warning = filled > 0 ? ` В ней ${filled} заполненных вопросов.` : ''
    if (!window.confirm(`Удалить категорию «${c.title}»?${warning} Это нельзя отменить.`)) return
    dropMedia(...c.questions.flatMap(mediaIdsOf))
    change((g) => removeCategory(g, c.id))
  }

  function addQuestion(c: Category) {
    if (c.questions.length >= MAX_QUESTIONS) return
    const value = Math.max(0, ...c.questions.map((q) => q.value)) + 100
    const created = newQuestion(value)
    change((g) => updateCategory(g, c.id, (x) => ({ ...x, questions: [...x.questions, created] })))
    setSelectedId(created.id) // сразу открываем, чтобы заполнить
  }

  function deleteQuestion(q: Question) {
    if (!isEmptyQuestion(q) && !window.confirm(`Удалить вопрос за ${q.value}? Это нельзя отменить.`)) return
    dropMedia(...mediaIdsOf(q))
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
            href={`#/teams/${encodeURIComponent(game.id)}`}
            className="flex h-11 items-center rounded-lg border border-line px-4 hover:bg-cell"
          >
            Команды · {game.teams.length}
          </a>
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
          onMediaRemoved={(id) => dropMedia(id)}
          onDelete={() => deleteQuestion(question)}
          onClose={() => setSelectedId(null)}
          onPreview={() => setPreviewing(true)}
          hiddenQuestions={hiddenQuestions(game).filter((h) => h.id !== question.id)}
          canHide={!isFinal}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
            <div role="tablist" aria-label="Раунды" className="flex flex-wrap gap-1.5">
              {game.rounds.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={r.id === round.id}
                  onClick={() => setRoundId(r.id)}
                  className={`h-11 rounded-lg px-4 text-sm ${r.id === round.id ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
                >
                  {r.title}
                  {r.hidden && <span aria-label=", скрытый"> 🔒</span>}
                  {problems.some((p) => p.roundId === r.id) && <span aria-label=", есть недочёты"> ⚠</span>}
                </button>
              ))}
            </div>
            <button type="button" onClick={newRound} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
              + Раунд
            </button>
            <div role="group" aria-label="Тип раунда" className="ml-auto flex items-center gap-1.5">
              {(['standard', 'final'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setRoundKind(kind)}
                  aria-pressed={(kind === 'final') === isFinal}
                  className={`h-11 rounded-lg px-3 text-sm ${(kind === 'final') === isFinal ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
                >
                  {kind === 'final' ? 'Финал' : 'Обычный раунд'}
                </button>
              ))}
            </div>
            {game.rounds[0]?.id !== round.id && (
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm" title="Раунд откроет правило «ЕСЛИ → ТО» или ведущий на пульте">
                <input
                  type="checkbox"
                  checked={!!round.hidden}
                  onChange={(e) => {
                    const hidden = e.target.checked || undefined
                    change((g) => updateRound(g, round.id, (r) => ({ ...r, hidden })))
                  }}
                  className="h-5 w-5 accent-white"
                />
                🔒 Скрытый раунд
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-muted">
              Название раунда
              <input
                value={round.title}
                onChange={(e) => {
                  const title = e.target.value
                  change((g) => updateRound(g, round.id, (r) => ({ ...r, title })))
                }}
                onBlur={() => {
                  if (!round.title.trim()) change((g) => updateRound(g, round.id, (r) => ({ ...r, title: 'Раунд' })))
                }}
                className="h-11 w-48 rounded-lg border border-line bg-bg px-3 text-white focus:border-white focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={deleteRound}
              disabled={game.rounds.length <= 1}
              className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40"
            >
              Удалить раунд
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {isFinal ? (
              <p className="text-muted">
                Финал: каждая категория — тема с одним вопросом. В игре команды по очереди убирают темы, на последнюю
                делают ставки, отвечают все сразу.
              </p>
            ) : (
              <p className="text-muted">
                Нажмите на ячейку, чтобы изменить вопрос: текст, слайды, картинку или музыку. Название категории меняется
                прямо в строке.
              </p>
            )}
            {!isFinal && <div role="group" aria-label="Готовая сетка" className="flex items-center gap-2">
              <span className="text-sm text-muted">Вопросов в категории:</span>
              {GRID_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => applyGrid(size)}
                  aria-pressed={currentGrid === size}
                  aria-label={`Сетка на ${size} вопросов в каждой категории`}
                  className={`h-11 min-w-11 rounded-lg px-3 font-display ${currentGrid === size ? 'bg-white text-black' : 'border border-line hover:bg-cell'}`}
                >
                  {size}
                </button>
              ))}
            </div>}
          </div>

          <GameCheck game={game} problems={problems} onShow={showProblem} />

          <div className="flex flex-col gap-3">
            {round.categories.map((c, i) => (
              <CategoryRow
                key={c.id}
                category={c}
                columns={columns}
                twoRows={cells > 6}
                final={isFinal}
                isFirst={i === 0}
                isLast={i === round.categories.length - 1}
                onRename={(title) => change((g) => updateCategory(g, c.id, (x) => ({ ...x, title })))}
                onMove={(delta) => change((g) => moveCategory(g, c.id, delta))}
                onDelete={() => deleteCategory(c)}
                onOpenQuestion={setSelectedId}
                onAddQuestion={() => addQuestion(c)}
              />
            ))}
            {round.categories.length === 0 && <p className="text-muted">В этом раунде пока нет ни одной категории.</p>}
          </div>

          <button
            type="button"
            onClick={addCategory}
            className="h-11 self-start rounded-lg border border-white px-5 font-semibold hover:bg-white hover:text-black"
          >
            + Добавить категорию
          </button>

          <RulesEditor
            game={game}
            onChange={(update) => change((g) => ({ ...g, rules: update(g.rules) }))}
            onMediaRemoved={(id) => dropMedia(id)}
          />

          <ThemeEditor
            theme={game.theme}
            onChange={(patch) => change((g) => ({ ...g, theme: { ...g.theme, ...patch } }))}
            onMediaRemoved={(id) => dropMedia(id)}
          />
        </>
      )}

      {previewing && category && question && (
        <HallPreview
          theme={game.theme}
          gameTitle={game.title}
          roundTitle={round.title}
          question={question}
          onClose={() => setPreviewing(false)}
        />
      )}
    </div>
  )
}

// Проверка игры: сколько недочётов и список — клик по строке открывает то, что нужно исправить.
// Длинный список свёрнут до первых пяти.
function GameCheck({ game, problems, onShow }: {
  game: Game
  problems: GameProblem[]
  onShow: (problem: GameProblem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 5

  if (problems.length === 0) {
    return <p className="text-sm text-muted">✓ Проверка игры: недочётов нет, можно играть.</p>
  }

  const roundTitle = (id: string) => game.rounds.find((r) => r.id === id)?.title
  const categoryTitle = (id?: string) => game.rounds.flatMap((r) => r.categories).find((c) => c.id === id)?.title
  const shown = expanded ? problems : problems.slice(0, LIMIT)

  return (
    <section aria-label="Проверка игры" className="flex flex-col gap-2 rounded-xl border border-white p-4">
      <h2 className="font-semibold">
        ⚠ Проверка игры: {problems.length} {plural(problems.length, 'недочёт', 'недочёта', 'недочётов')}
      </h2>
      <ul className="flex flex-col">
        {shown.map((p, i) => {
          // Где недочёт: раунд (если их несколько) и категория
          const where = [game.rounds.length > 1 && p.roundId ? roundTitle(p.roundId) : null, categoryTitle(p.categoryId)]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onShow(p)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-cell"
              >
                {where && <span className="text-muted">{where} —</span>}
                <span>{p.text}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {problems.length > LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="h-11 self-start rounded-lg border border-line px-4 text-sm hover:bg-cell"
        >
          {expanded ? 'Свернуть' : `Показать все (${problems.length})`}
        </button>
      )}
    </section>
  )
}

// Строка категории:порядок, название, ячейки вопросов, «+ вопрос», удаление
function CategoryRow({ category, columns, twoRows, final, isFirst, isLast, onRename, onMove, onDelete, onOpenQuestion, onAddQuestion }: {
  category: Category
  columns: number // сколько ячеек в одном ряду
  twoRows: boolean // ячейки идут в два ряда — делаем их пониже
  final: boolean // финал: в теме один вопрос, стоимости нет (играют на ставки)
  isFirst: boolean
  isLast: boolean
  onRename: (title: string) => void
  onMove: (delta: number) => void
  onDelete: () => void
  onOpenQuestion: (questionId: string) => void
  onAddQuestion: () => void
}) {
  const rowButton = 'h-11 min-w-11 rounded-lg border border-line px-3 text-sm hover:bg-cell disabled:opacity-40'
  const cellHeight = twoRows ? 'min-h-16' : 'min-h-20'

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line p-3">
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
        className="h-20 w-48 shrink-0 rounded-xl border border-transparent bg-cell px-4 font-display text-lg text-white hover:border-line focus:border-white focus:outline-none"
      />

      <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {sortByValue(category.questions).map((q) => {
          const note = cellNote(q)
          const empty = note === 'пусто'
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onOpenQuestion(q.id)}
              className={`@container flex ${cellHeight} flex-col items-center justify-center rounded-xl border-2 font-display transition hover:bg-white hover:text-black ${empty ? 'border-dashed border-muted text-muted' : 'border-white'}`}
            >
              <span className="text-[min(1.875rem,20cqw)]">{final ? 'ВОПРОС' : q.value}</span>
              {note && <span className="font-sans text-xs font-normal">{note}</span>}
            </button>
          )
        })}

        {category.questions.length < (final ? 1 : MAX_QUESTIONS) && (
          <button
            type="button"
            onClick={onAddQuestion}
            aria-label={`Добавить вопрос в категорию «${category.title}»`}
            className={`flex ${cellHeight} items-center justify-center rounded-xl border-2 border-dashed border-line text-3xl text-muted hover:border-white hover:text-white`}
          >
            +
          </button>
        )}
      </div>

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
