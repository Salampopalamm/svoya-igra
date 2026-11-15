import type { Category, Game, Question, Round } from './types'

// Чистые функции для работы с игрой: берут игру и возвращают новую, старую не меняют.

const newId = () => crypto.randomUUID()

// Пустой вопрос: один пустой слайд, пустой ответ
export function newQuestion(value: number): Question {
  return { id: newId(), value, kind: 'normal', slides: [{}], answer: {}, played: false }
}

// Новая категория — сразу с пятью пустыми вопросами 100…500, как на обычном табло
export function newCategory(): Category {
  return { id: newId(), title: 'Новая категория', questions: [100, 200, 300, 400, 500].map(newQuestion) }
}

// Изменить один раунд (по id)
export function updateRound(game: Game, roundId: string, change: (r: Round) => Round): Game {
  return { ...game, rounds: game.rounds.map((r) => (r.id === roundId ? change(r) : r)) }
}

// Изменить одну категорию (по id) в любом раунде
export function updateCategory(game: Game, categoryId: string, change: (c: Category) => Category): Game {
  return {
    ...game,
    rounds: game.rounds.map((r) => ({ ...r, categories: r.categories.map((c) => (c.id === categoryId ? change(c) : c)) })),
  }
}

// Убрать категорию из игры
export function removeCategory(game: Game, categoryId: string): Game {
  return { ...game, rounds: game.rounds.map((r) => ({ ...r, categories: r.categories.filter((c) => c.id !== categoryId) })) }
}

// Поменять категорию местами с соседней: delta = -1 — выше, +1 — ниже
export function moveCategory(game: Game, categoryId: string, delta: number): Game {
  return {
    ...game,
    rounds: game.rounds.map((r) => {
      const index = r.categories.findIndex((c) => c.id === categoryId)
      const target = index + delta
      if (index < 0 || target < 0 || target >= r.categories.length) return r
      const categories = [...r.categories]
      ;[categories[index], categories[target]] = [categories[target], categories[index]]
      return { ...r, categories }
    }),
  }
}

// Убрать вопрос из игры
export function removeQuestion(game: Game, questionId: string): Game {
  return {
    ...game,
    rounds: game.rounds.map((r) => ({
      ...r,
      categories: r.categories.map((c) => ({ ...c, questions: c.questions.filter((q) => q.id !== questionId) })),
    })),
  }
}

// Вопросы категории по возрастанию стоимости (так они стоят на табло)
export function sortByValue(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => a.value - b.value)
}

// id всех файлов вопроса — чтобы удалить их из хранилища вместе с вопросом
export function mediaIdsOf(question: Question): string[] {
  return [...question.slides, question.answer].flatMap((c) => (c.media ? [c.media.id] : []))
}

// Есть ли в вопросе хоть что-то (текст или файл)
export function isEmptyQuestion(question: Question): boolean {
  return [...question.slides, question.answer].every((c) => !c.text?.trim() && !c.media)
}

// ---- Команды ----

export const MAX_TEAMS = 10 // 1–10: на пульте команды выбираются клавишами 1–9 и 0

// Добавить команду в конец: «Команда N», где N — первый свободный номер
export function addTeam(game: Game): Game {
  if (game.teams.length >= MAX_TEAMS) return game
  const names = new Set(game.teams.map((t) => t.name))
  let n = game.teams.length + 1
  while (names.has(`Команда ${n}`)) n++
  return { ...game, teams: [...game.teams, { id: newId(), name: `Команда ${n}`, score: 0 }] }
}

export function renameTeam(game: Game, teamId: string, name: string): Game {
  return { ...game, teams: game.teams.map((t) => (t.id === teamId ? { ...t, name } : t)) }
}

// Убрать команду; последнюю оставшуюся убрать нельзя
export function removeTeam(game: Game, teamId: string): Game {
  if (game.teams.length <= 1) return game
  return {
    ...game,
    teams: game.teams.filter((t) => t.id !== teamId),
    players: game.players.map((p) => (p.teamId === teamId ? { ...p, teamId: undefined } : p)),
  }
}

// Поменять команду местами с соседней: от порядка зависит номер и клавиша на пульте
export function moveTeam(game: Game, teamId: string, delta: number): Game {
  const index = game.teams.findIndex((t) => t.id === teamId)
  const target = index + delta
  if (index < 0 || target < 0 || target >= game.teams.length) return game
  const teams = [...game.teams]
  ;[teams[index], teams[target]] = [teams[target], teams[index]]
  return { ...game, teams }
}

// Копия игры с новым id и названием «… (копия)». Файлы общие: удаляются, только когда не нужны ни одной игре.
export function copyGame(game: Game): Game {
  return { ...game, id: newId(), title: `${game.title} (копия)` }
}

// Все вопросы игры одним списком
export function allQuestions(game: Game): Question[] {
  return game.rounds.flatMap((r) => r.categories.flatMap((c) => c.questions))
}

// Заменить один вопрос (по id) на изменённый
export function updateQuestion(game: Game, questionId: string, change: (q: Question) => Question): Game {
  return {
    ...game,
    rounds: game.rounds.map((round) => ({
      ...round,
      categories: round.categories.map((category) => ({
        ...category,
        questions: category.questions.map((q) => (q.id === questionId ? change(q) : q)),
      })),
    })),
  }
}

// Содержимое игры (вопросы, файлы, названия) берём из `content` — это свежая версия из хранилища,
// а ход партии (счёт команд и сыгранные вопросы) — из `progress`, сохранённой партии.
// Нужно, чтобы правки в редакторе не терялись, если игра уже начата.
export function mergeProgress(content: Game, progress: Game): Game {
  const scores = new Map(progress.teams.map((t) => [t.id, t.score]))
  const played = new Set(allQuestions(progress).filter((q) => q.played).map((q) => q.id))

  const withPlayed = allQuestions(content).reduce(
    (game, q) => (played.has(q.id) ? updateQuestion(game, q.id, (x) => ({ ...x, played: true })) : game),
    content,
  )
  return { ...withPlayed, teams: withPlayed.teams.map((t) => ({ ...t, score: scores.get(t.id) ?? t.score })) }
}
