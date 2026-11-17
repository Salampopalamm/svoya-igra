import { treeContents, treeProblems } from './tree'
import type { Category, Content, Game, MediaRef, Player, Question, Round, Team } from './types'

// Чистые функции для работы с игрой: берут игру и возвращают новую, старую не меняют.

const newId = () => crypto.randomUUID()

// Пустой вопрос: один пустой слайд, пустой ответ
export function newQuestion(value: number): Question {
  return { id: newId(), value, kind: 'normal', slides: [{}], answer: {}, played: false }
}

// ---- Сетка: сколько вопросов в категории ----

export const MAX_QUESTIONS = 10 // больше 10 номиналов в строке табло не помещается
export const GRID_SIZES = [5, 8, 10] // готовые сетки
export const DEFAULT_GRID = 10

// Номиналы сетки: 100, 200, … size × 100
const gridValues = (size: number) => Array.from({ length: size }, (_, i) => (i + 1) * 100)

// Новая категория с пустыми вопросами; по умолчанию 10 вопросов: 100…1000
export function newCategory(size = DEFAULT_GRID): Category {
  return { id: newId(), title: 'Новая категория', questions: gridValues(size).map(newQuestion) }
}

// Сколько вопросов давать новой категории: как в самой длинной строке раунда, а в пустом раунде — 10
export function gridSizeOf(round: Round): number {
  const counts = round.categories.map((c) => c.questions.length)
  return counts.length > 0 ? Math.min(Math.max(...counts), MAX_QUESTIONS) : DEFAULT_GRID
}

// Привести категорию к сетке из size вопросов.
// Не хватает — добавляем пустые вопросы с недостающими номиналами (100…size × 100).
// Лишние — убираем сначала пустые, потом заполненные, начиная с самых дорогих.
// Возвращает новую категорию и список убранных вопросов (чтобы предупредить и удалить их файлы).
export function resizeCategory(category: Category, size: number): { category: Category; removed: Question[] } {
  let questions = sortByValue(category.questions)

  if (questions.length < size) {
    const taken = new Set(questions.map((q) => q.value))
    const free = gridValues(MAX_QUESTIONS).filter((v) => !taken.has(v))
    let next = Math.max(0, ...questions.map((q) => q.value)) // на случай нестандартных номиналов
    while (free.length < size - questions.length) free.push((next += 100))
    questions = sortByValue([...questions, ...free.slice(0, size - questions.length).map(newQuestion)])
  }

  const removed: Question[] = []
  const byValueDesc = (list: Question[]) => [...list].sort((a, b) => b.value - a.value)
  for (const q of [...byValueDesc(questions.filter(isEmptyQuestion)), ...byValueDesc(questions)]) {
    if (questions.length - removed.length <= size) break
    if (!removed.includes(q)) removed.push(q)
  }

  return { category: { ...category, questions: questions.filter((q) => !removed.includes(q)) }, removed }
}

// Привести все категории раунда к одной сетке
export function resizeRound(round: Round, size: number): { round: Round; removed: Question[] } {
  const results = round.categories.map((c) => resizeCategory(c, size))
  return {
    round: { ...round, categories: results.map((r) => r.category) },
    removed: results.flatMap((r) => r.removed),
  }
}

// ---- Раунды ----

// Раунд по id; если такого нет (например, удалили) — первый
export function roundById(game: Game, roundId: string | null | undefined): Round {
  return game.rounds.find((r) => r.id === roundId) ?? game.rounds[0]
}

// Новый раунд в конце: «Раунд N» с одной категорией — сетка как в последнем раунде
export function addRound(game: Game): { game: Game; round: Round } {
  const last = game.rounds.at(-1)
  const round: Round = {
    id: newId(),
    title: `Раунд ${game.rounds.length + 1}`,
    kind: 'standard',
    categories: [newCategory(last ? gridSizeOf(last) : DEFAULT_GRID)],
  }
  return { game: { ...game, rounds: [...game.rounds, round] }, round }
}

// Убрать раунд; последний оставшийся убрать нельзя
export function removeRound(game: Game, roundId: string): Game {
  if (game.rounds.length <= 1) return game
  return { ...game, rounds: game.rounds.filter((r) => r.id !== roundId) }
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

// Всё содержимое вопроса: слайды, ответ и шаги дерева (если вопрос ветвящийся)
export function questionContents(question: Question): Content[] {
  return [...question.slides, question.answer, ...treeContents(question.tree)]
}

// id всех файлов вопроса — чтобы удалить их из хранилища вместе с вопросом
export function mediaIdsOf(question: Question): string[] {
  return questionContents(question).flatMap((c) => (c.media ? [c.media.id] : []))
}

// Есть ли в вопросе хоть что-то (текст или файл)
export function isEmptyQuestion(question: Question): boolean {
  return questionContents(question).every((c) => !c.text?.trim() && !c.media)
}

// ---- Проверка игры ----

// Недочёт вопроса: заполнен наполовину. Пустой вопрос — не недочёт вопроса (о нём скажет проверка категории).
export type QuestionProblem = 'no-answer' | 'no-question' | 'tree'

const hasContent = (c: Content) => Boolean(c.text?.trim() || c.media)

export function questionProblem(question: Question): QuestionProblem | null {
  if (isEmptyQuestion(question)) return null
  // Ветвящийся вопрос: слайды и ответ не нужны, проверяем само дерево
  if (question.tree) return treeProblems(question.tree).length > 0 ? 'tree' : null
  if (!question.slides.some(hasContent)) return 'no-question'
  if (!hasContent(question.answer)) return 'no-answer'
  return null
}

export type GameProblem = {
  roundId?: string // нет — недочёт не в раунде (например, в правилах игры)
  categoryId?: string
  questionId?: string // какой вопрос открыть, чтобы исправить
  text: string
}

// Все недочёты игры по порядку: раунд → категория → вопросы по стоимости.
// Одинаковая стоимость в категории — не недочёт: так можно.
export function gameProblems(game: Game): GameProblem[] {
  const problems: GameProblem[] = []
  for (const round of game.rounds) {
    if (round.categories.length === 0) {
      problems.push({ roundId: round.id, text: 'в раунде нет ни одной категории' })
    }
    for (const category of round.categories) {
      const at = { roundId: round.id, categoryId: category.id }
      const questions = sortByValue(category.questions)
      const empty = questions.filter(isEmptyQuestion)

      if (empty.length === questions.length) {
        problems.push({ ...at, text: 'в категории нет ни одного заполненного вопроса' })
        continue
      }
      for (const q of questions) {
        const problem = questionProblem(q)
        if (problem === 'no-answer') problems.push({ ...at, questionId: q.id, text: `вопрос за ${q.value} без ответа` })
        if (problem === 'no-question') problems.push({ ...at, questionId: q.id, text: `за ${q.value} есть ответ, но нет вопроса` })
        if (problem === 'tree' && q.tree) {
          problems.push({ ...at, questionId: q.id, text: `за ${q.value}, дерево: ${treeProblems(q.tree)[0].text}` })
        }
      }
      if (empty.length > 0) {
        const values = empty.map((q) => q.value).join(', ')
        const text = empty.length === 1 ? `пустая ячейка за ${values}` : `пустые ячейки за ${values}`
        problems.push({ ...at, questionId: empty[0].id, text: `${text} — заполните или удалите` })
      }
    }
  }
  return problems
}

// ---- Команды ----

export const MAX_TEAMS = 10 // 1–10: на пульте команды выбираются клавишами 1–9 и 0

// Значки команд на выбор: крупные, узнаваемые издалека, без людей и флагов
export const TEAM_EMOJI = [
  '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🐙', '🦉', '🐝', '🦄',
  '🚀', '⚡', '🔥', '🌟', '🌈', '❄️', '🌵', '🍀', '🍕', '🍩',
  '🍉', '☕', '🎸', '🎯', '🎲', '🏆', '💎', '👑', '🎩', '🧠',
]

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

// Ход по кругу: следующая команда после этой (после последней — снова первая).
// Если команды с таким id уже нет — ход у первой.
export function nextTeamId(game: Game, teamId: string | null): string | null {
  const index = game.teams.findIndex((t) => t.id === teamId)
  if (index < 0) return game.teams[0]?.id ?? null
  return game.teams[(index + 1) % game.teams.length].id
}

export function updateTeam(game: Game, teamId: string, change: (t: Team) => Team): Game {
  return { ...game, teams: game.teams.map((t) => (t.id === teamId ? change(t) : t)) }
}

// ---- Участники ----

// Добавить участников по именам (пустые строки пропускаем). teamId — сразу в эту команду.
export function addPlayers(game: Game, names: string[], teamId?: string): Game {
  const players: Player[] = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ id: newId(), name, teamId }))
  return { ...game, players: [...game.players, ...players] }
}

// Имена из вставленного текста: по одному на строку. Из Excel берём первый столбец.
export function namesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t')[0].trim())
    .filter(Boolean)
}

export function updatePlayer(game: Game, playerId: string, change: (p: Player) => Player): Game {
  return { ...game, players: game.players.map((p) => (p.id === playerId ? change(p) : p)) }
}

export function removePlayer(game: Game, playerId: string): Game {
  return { ...game, players: game.players.filter((p) => p.id !== playerId) }
}

// Перемешать список (честно: каждый порядок равновероятен)
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Случайное распределение по командам.
// Закреплённые (капитаны) остаются на месте. Остальные перемешиваются и идут:
//   1) в команды с заданным размером — пока команда не заполнится;
//   2) остальные — в команды без размера, каждый раз в ту, где сейчас меньше всего людей;
//      если размер задан у всех команд, лишние люди тоже идут туда, где меньше всего.
export function distributeRandomly(game: Game, random: () => number = Math.random): Game {
  const teamIds = new Set(game.teams.map((t) => t.id))
  const stays = (p: Player) => p.locked && p.teamId && teamIds.has(p.teamId)
  const count = new Map(game.teams.map((t) => [t.id, game.players.filter((p) => stays(p) && p.teamId === t.id).length]))
  const assigned = new Map<string, string>() // игрок → команда

  const free = shuffle(game.players.filter((p) => !stays(p)), random)
  for (const team of game.teams) {
    while (team.targetSize && count.get(team.id)! < team.targetSize && free.length > 0) {
      assigned.set(free.shift()!.id, team.id)
      count.set(team.id, count.get(team.id)! + 1)
    }
  }

  const open = game.teams.filter((t) => !t.targetSize)
  const pool = open.length > 0 ? open : game.teams
  for (const player of free) {
    const smallest = pool.reduce((a, b) => (count.get(b.id)! < count.get(a.id)! ? b : a))
    assigned.set(player.id, smallest.id)
    count.set(smallest.id, count.get(smallest.id)! + 1)
  }

  return { ...game, players: game.players.map((p) => (assigned.has(p.id) ? { ...p, teamId: assigned.get(p.id) } : p)) }
}

// Все файлы игры: в вопросах, фото участников, значки команд, оформление (могут повторяться)
export function allMediaRefs(game: Game): MediaRef[] {
  const { logo, background, sounds } = game.theme
  const contents = allQuestions(game).flatMap(questionContents)
  return [
    ...contents.map((c) => c.media),
    ...game.players.map((p) => p.photo),
    ...game.teams.map((t) => t.logo),
    logo,
    background,
    sounds.correct,
    sounds.wrong,
    ...game.rules.map((r) => r.then.media), // картинки и видео, которые правила показывают в зале
  ].filter((m): m is MediaRef => !!m)
}

// id всех файлов игры
export function allMediaIds(game: Game): string[] {
  return allMediaRefs(game).map((m) => m.id)
}

// Копия игры с новым id и названием «… (копия)». Файлы общие: удаляются, только когда не нужны ни одной игре.
export function copyGame(game: Game): Game {
  return { ...game, id: newId(), title: `${game.title} (копия)` }
}

// Все заполненные вопросы обычных раундов по порядку табло: раунд → категория → ячейки слева направо.
// По этому списку идёт репетиция («Следующий вопрос»). Финал репетируют, просто сыграв его.
export type CellAddress = { roundId: string; categoryId: string; questionId: string }

export function rehearsalCells(game: Game): CellAddress[] {
  return game.rounds
    .filter((r) => r.kind !== 'final')
    .flatMap((r) =>
      r.categories.flatMap((c) =>
        sortByValue(c.questions)
          .filter((q) => !isEmptyQuestion(q))
          .map((q) => ({ roundId: r.id, categoryId: c.id, questionId: q.id })),
      ),
    )
}

// Скрытые вопросы игры — для списка «вариант открывает…» в дереве. Подпись: «Раунд · Категория · 400».
export type HiddenChoice = { id: string; label: string }

export function hiddenQuestions(game: Game): HiddenChoice[] {
  return game.rounds
    .filter((r) => r.kind !== 'final')
    .flatMap((r) =>
      r.categories.flatMap((c) =>
        sortByValue(c.questions)
          .filter((q) => q.hidden)
          .map((q) => ({ id: q.id, label: `${game.rounds.length > 1 ? `${r.title} · ` : ''}${c.title} · ${q.value}` })),
      ),
    )
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
