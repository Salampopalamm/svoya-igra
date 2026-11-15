import type { Game, Question } from './types'

// Чистые функции для работы с игрой: берут игру и возвращают новую, старую не меняют.

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
