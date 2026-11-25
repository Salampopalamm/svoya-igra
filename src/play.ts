import { betsReady, FINAL_TIMER_SEC, finalStateOf, participants, remainingThemes, removeTheme, withFinalScores } from './final'
import { hiddenQuestions, nextTeamId, roundById } from './game'
import { withLog } from './log'
import { newTimer, pauseTimer, startTimer, type Current, type FinalState, type LiveState } from './live'
import { describeRule, needsTeam, targetTeam } from './rules'
import { correctPoints, isForAll, wrongPoints } from './special'
import { chooseOption, startBranch } from './tree'
import type { Game, Question, Rule, Theme } from './types'

// Ход партии: чистые функции над LiveState. Берут состояние и возвращают новое, старое не меняют.
// Пульт (HostApp) только вызывает их и решает, запомнить ли шаг для Ctrl+Z.
// Если действие сейчас невозможно (например, «Верно» команде, которая уже ошиблась), функция возвращает
// то же самое состояние — пульт по этому понимает, что ничего не произошло.

export const DEFAULT_TIMER_SEC = 30 // клавиша T на вопросе без таймера

export type CellRef = { categoryId: string; questionId: string }

// Свежая партия: игра из хранилища, всё по нулям
export function freshState(game: Game): LiveState {
  return {
    game,
    roundId: game.rounds[0]?.id ?? null,
    current: null,
    slideIndex: 0,
    showAnswer: false,
    answeringTeamId: null,
    turnTeamId: game.teams[0]?.id ?? null,
    triedTeamIds: [],
    screenHidden: false,
    timer: null,
    video: null,
  }
}

// ---- Где мы ----

// Вопрос ячейки на табло (в раунде, который сейчас на табло)
export function cellQuestion(s: LiveState, cell: CellRef | null): Question | undefined {
  if (!cell) return undefined
  const category = roundById(s.game, s.roundId).categories.find((c) => c.id === cell.categoryId)
  return category?.questions.find((q) => q.id === cell.questionId)
}

// Открытый сейчас вопрос
export const openQuestion = (s: LiveState) => cellQuestion(s, s.current)

// Подпись ячейки для журнала: «География · 300»
export function cellLabel(s: LiveState, cell: CellRef | null): string | undefined {
  if (!cell) return undefined
  const category = roundById(s.game, s.roundId).categories.find((c) => c.id === cell.categoryId)
  const question = category?.questions.find((q) => q.id === cell.questionId)
  return category && question ? `${category.title} · ${question.value}` : undefined
}

// Запись журнала об открытом вопросе
function aboutCurrent(s: LiveState) {
  return { questionId: s.current?.questionId, where: cellLabel(s, s.current) }
}

// Ход финала, если на табло финальный раунд (иначе null)
export function finalOf(s: LiveState): FinalState | null {
  const round = roundById(s.game, s.roundId)
  return round.kind === 'final' ? finalStateOf(s.final, round) : null
}

// ---- Счёт и сыгранные ячейки ----

export function withPlayed(s: LiveState, cell: Current): LiveState {
  if (!cell) return s
  return {
    ...s,
    game: {
      ...s.game,
      rounds: s.game.rounds.map((r) => ({
        ...r,
        categories: r.categories.map((c) =>
          c.id !== cell.categoryId
            ? c
            : { ...c, questions: c.questions.map((q) => (q.id === cell.questionId ? { ...q, played: true } : q)) },
        ),
      })),
    },
  }
}

// Ведущий поправил счёт сам: кнопки ± или вписал счёт целиком (в журнал — как поправку)
export function adjustScore(s: LiveState, teamId: string, delta: number): LiveState {
  if (!delta) return s
  return withLog(withScore(s, teamId, delta), { kind: 'manual', teamId, points: delta })
}

export function setScore(s: LiveState, teamId: string, score: number): LiveState {
  const team = s.game.teams.find((t) => t.id === teamId)
  if (!team || team.score === score) return s
  return withLog(withTeamScore(s, teamId, () => score), { kind: 'manual', teamId, points: score - team.score, note: `вписан счёт ${score}` })
}

// Прибавить (или отнять) баллы — без записи в журнал (запись делает тот, кто знает причину)
export function withScore(s: LiveState, teamId: string, delta: number): LiveState {
  return withTeamScore(s, teamId, (score) => score + delta)
}

// Ручная правка счёта: вписать счёт целиком
export function withTeamScore(s: LiveState, teamId: string, change: (score: number) => number): LiveState {
  return {
    ...s,
    game: { ...s.game, teams: s.game.teams.map((t) => (t.id === teamId ? { ...t, score: change(t.score) } : t)) },
  }
}

// ---- Вопрос: открыть, ответить, закрыть ----

// Таймер вопроса: закреплённое на пульте время (📌) важнее времени из редактора
export function questionTimer(question: Question | undefined, theme: Theme) {
  return newTimer(theme.pinnedTimerSec ?? question?.timerSec)
}

// Только что открытый вопрос: первый слайд, ответ скрыт, таймер ждёт запуска, ветвящийся — на первом шаге
export function openedQuestion(question: Question | undefined, theme: Theme): Partial<LiveState> {
  return {
    slideIndex: 0,
    showAnswer: false,
    triedTeamIds: [],
    viewOnly: false,
    timer: questionTimer(question, theme),
    video: null,
    branch: question?.tree ? startBranch(question.tree) : null,
    marks: {},
  }
}

// Сыграть ячейку: первой отвечает команда, чей ход (на вопрос «для всех команд» — все сразу)
export function openCell(s: LiveState, cell: CellRef): LiveState {
  const question = cellQuestion(s, cell)
  return {
    ...s,
    ...openedQuestion(question, s.game.theme),
    current: cell,
    answeringTeamId: isForAll(question) ? null : s.turnTeamId,
  }
}

// Сыгранную (красную) ячейку открыли только посмотреть: без «Верно / Неверно», ход потом не переходит
export function viewPlayedCell(s: LiveState, cell: CellRef): LiveState {
  return { ...s, ...openedQuestion(cellQuestion(s, cell), s.game.theme), current: cell, answeringTeamId: null, viewOnly: true }
}

// Закрыть вопрос: ячейка сыграна, ход переходит к следующей команде по кругу
// (если вопрос открывали только посмотреть — ход остаётся у той же команды)
export function withClosed(s: LiveState): LiveState {
  return {
    ...withPlayed(s, s.current),
    current: null,
    slideIndex: 0,
    showAnswer: false,
    answeringTeamId: null,
    triedTeamIds: [],
    viewOnly: false,
    turnTeamId: s.viewOnly ? s.turnTeamId : nextTeamId(s.game, s.turnTeamId),
    timer: null,
    video: null,
    branch: null,
    marks: {},
  }
}

// Можно ли этой команде сейчас ответить «Верно / Неверно»: обычный вопрос открыт, не «только посмотреть»,
// команда ещё не ошибалась на нём
function canAnswer(s: LiveState, teamId: string): Question | null {
  const question = openQuestion(s)
  if (!question || question.tree || isForAll(question) || s.viewOnly || s.triedTeamIds.includes(teamId)) return null
  return question
}

// Верно: команда получает стоимость (у особого вопроса — ×2, ×3), вопрос закрывается, ход — следующей по кругу
export function answerCorrect(s: LiveState, teamId: string): LiveState {
  const question = canAnswer(s, teamId)
  if (!question) return s
  const points = correctPoints(question)
  return withClosed(withLog(withScore(s, teamId, points), { kind: 'correct', teamId, points, ...aboutCurrent(s) }))
}

// Ведущий закрыл вопрос сам — значит, верного ответа не было (верный ответ закрывает вопрос сразу)
export function closeQuestion(s: LiveState): LiveState {
  if (!s.current) return s
  const question = openQuestion(s)
  const nobody = !s.viewOnly && !question?.tree && !finalOf(s)
  return withClosed(nobody ? withLog(s, { kind: 'nobody', points: 0, ...aboutCurrent(s) }) : s)
}

// Неверно: команда теряет стоимость (у вопроса «без минуса» — ничего), вопрос остаётся открытым — его могут перехватить остальные
export function answerWrong(s: LiveState, teamId: string): LiveState {
  const question = canAnswer(s, teamId)
  if (!question) return s
  const points = 0 - wrongPoints(question) || 0 // «|| 0» — без «−0» у вопроса без минуса
  const scored = withLog(withScore(s, teamId, points), { kind: 'wrong', teamId, points, ...aboutCurrent(s) })
  return { ...scored, answeringTeamId: null, triedTeamIds: [...s.triedTeamIds, teamId] }
}

// Кто отвечает сейчас (основная команда или перехват; null — никто). Ошибившимся командам отвечать нельзя.
export function selectAnswering(s: LiveState, teamId: string | null): LiveState {
  if (s.viewOnly || isForAll(openQuestion(s)) || (teamId && s.triedTeamIds.includes(teamId))) return s
  return { ...s, answeringTeamId: teamId }
}

// ---- Вопрос «для всех команд»: отвечают все сразу (на бумажках), ведущий отмечает каждую ----

// Отметка команды: верно / неверно; та же ещё раз — снять (команда не ответила)
export function markAll(s: LiveState, teamId: string, correct: boolean): LiveState {
  if (!isForAll(openQuestion(s)) || s.viewOnly || !s.game.teams.some((t) => t.id === teamId)) return s
  const marks = { ...s.marks }
  if (marks[teamId] === correct) delete marks[teamId]
  else marks[teamId] = correct
  return { ...s, marks }
}

// Подвести итог: верные получают стоимость, неверные теряют, без отметки — ничего. Вопрос закрывается.
export function revealAll(s: LiveState): LiveState {
  const question = openQuestion(s)
  if (!question || !isForAll(question) || s.viewOnly) return s
  const marks = s.marks ?? {}
  const marked = s.game.teams.filter((t) => marks[t.id] !== undefined)
  let next = s
  for (const team of marked) {
    const correct = marks[team.id]
    const points = correct ? correctPoints(question) : 0 - wrongPoints(question) || 0
    next = withLog(withScore(next, team.id, points), {
      kind: correct ? 'correct' : 'wrong',
      teamId: team.id,
      points,
      note: 'все команды',
      ...aboutCurrent(s),
    })
  }
  if (!marked.length) next = withLog(next, { kind: 'nobody', points: 0, ...aboutCurrent(s) })
  return withClosed(next)
}

// Передать ход другой команде (на табло)
export function setTurn(s: LiveState, teamId: string): LiveState {
  return teamId === s.turnTeamId ? s : { ...s, turnTeamId: teamId }
}

// Ветвящийся вопрос: ведущий нажал вариант. Баллы — сразу или одной суммой в конце ветки, следующий шаг.
// Вариант может открыть скрытый вопрос на табло.
export function chooseBranch(s: LiveState, option: number): LiveState {
  const question = openQuestion(s)
  const tree = question?.tree
  if (!tree || !s.branch || s.branch.done || !s.answeringTeamId || s.viewOnly) return s
  const node = tree.nodes.find((n) => n.id === s.branch!.nodeId)
  const points = node?.options[option]?.points ?? 0
  const branch = chooseOption(tree, s.branch, option)
  const gained = tree.scoring === 'per-step' ? points : branch.done ? branch.earned : 0
  const unlockedIds = s.unlockedIds ?? []
  const unlock = node?.options[option]?.unlockQuestionId
  const unlockable = unlock && hiddenQuestions(s.game).some((h) => h.id === unlock) && !unlockedIds.includes(unlock)
  const label = node?.options[option]?.label ?? ''
  const note = tree.scoring === 'at-end' && !branch.done ? `${label} (баллы — в конце ветки)` : label
  const scored = withLog(withScore(s, s.answeringTeamId, gained), {
    kind: 'branch',
    teamId: s.answeringTeamId,
    points: gained,
    note,
    ...aboutCurrent(s),
  })
  return {
    ...scored,
    unlockedIds: unlockable ? [...unlockedIds, unlock] : unlockedIds,
    branch,
    showAnswer: false,
    timer: questionTimer(question, s.game.theme),
    video: null,
  }
}

// ---- Слайды, ответ, таймер ----

// Листать слайды открытого вопроса; ушли со слайда с видео — оно останавливается
export function goToSlide(s: LiveState, delta: number): LiveState {
  const count = openQuestion(s)?.slides.length ?? 1
  const slideIndex = Math.min(Math.max(s.slideIndex + delta, 0), count - 1)
  return slideIndex === s.slideIndex ? s : { ...s, slideIndex, video: null }
}

// Ответ в зале — таймер больше не нужен, останавливаем
export function showAnswer(s: LiveState): LiveState {
  return { ...s, showAnswer: true, timer: s.timer && pauseTimer(s.timer) }
}

// Таймер: запустить / пауза. Если таймера у вопроса нет — запускаем на стандартное (или закреплённое) время.
export function toggleTimer(s: LiveState, now = Date.now()): LiveState {
  const timer = s.timer ?? newTimer(s.game.theme.pinnedTimerSec ?? DEFAULT_TIMER_SEC)
  if (!s.current || !timer) return s
  return { ...s, timer: timer.endsAt === null ? startTimer(timer, now) : pauseTimer(timer, now) }
}

// ---- Скрытое и правила ----

// Ведущий открыл скрытый вопрос сам
export function unlockQuestion(s: LiveState, questionId: string): LiveState {
  const unlockedIds = s.unlockedIds ?? []
  return unlockedIds.includes(questionId) ? s : { ...s, unlockedIds: [...unlockedIds, questionId] }
}

// Ведущий открыл скрытый раунд сам
export function unlockRound(s: LiveState, roundId: string): LiveState {
  const ids = s.unlockedRoundIds ?? []
  return ids.includes(roundId) ? s : { ...s, unlockedRoundIds: [...ids, roundId] }
}

// Скрытый раунд закрыт, пока его не откроет правило или ведущий
export function roundLocked(s: LiveState, round: { id: string; hidden?: boolean }): boolean {
  return !!round.hidden && !(s.unlockedRoundIds ?? []).includes(round.id)
}

// Перейти к другому раунду — только с табло и не в закрытый скрытый
export function switchRound(s: LiveState, roundId: string): LiveState {
  const target = s.game.rounds.find((r) => r.id === roundId)
  if (s.current || roundId === roundById(s.game, s.roundId).id || !target || roundLocked(s, target)) return s
  return { ...s, roundId }
}

// Выполнить правило «ЕСЛИ → ТО» (больше его не предлагаем)
export function runRule(s: LiveState, rule: Rule): LiveState {
  const { then } = rule
  let next = s
  if (then.kind === 'unlock-question') next = unlockQuestion(s, then.target)
  if (then.kind === 'open-round') next = unlockRound(s, then.target)
  if (then.kind === 'show-media' && then.media) next = { ...s, shownMedia: then.media }
  if (then.kind === 'show-text' && then.text) next = { ...s, shownText: then.text }
  // Баллы и ход — команде из условия, лидеру или отстающей (кто это — смотрим сейчас, когда ведущий нажал «Выполнить»)
  const team = needsTeam(then.kind) ? targetTeam(s.game, rule, s.log) : undefined
  if (then.kind === 'add-points' && team && then.points) {
    const note = 'правило: ' + describeRule(s.game, rule, s.log).when
    next = withLog(withScore(s, team.id, then.points), { kind: 'rule', teamId: team.id, points: then.points, note })
  }
  if (then.kind === 'give-turn' && team) next = { ...s, turnTeamId: team.id }
  return { ...next, rulesDone: [...(s.rulesDone ?? []), rule.id] }
}

// Пропустить правило (больше его не предлагаем)
export function skipRule(s: LiveState, rule: Rule): LiveState {
  return { ...s, rulesDone: [...(s.rulesDone ?? []), rule.id] }
}

// ---- Финал ----

// Команда убрала тему
export function finalRemoveTheme(s: LiveState, categoryId: string): LiveState {
  const final = finalOf(s)
  return final ? { ...s, final: removeTheme(roundById(s.game, s.roundId), final, categoryId) } : s
}

// Ставка команды (undefined — стереть)
export function finalSetBet(s: LiveState, teamId: string, bet: number | undefined): LiveState {
  const final = finalOf(s)
  if (!final) return s
  const bets = { ...final.bets }
  if (bet === undefined) delete bets[teamId]
  else bets[teamId] = bet
  return { ...s, final: { ...final, bets } }
}

// Ставки сделаны — открываем вопрос оставшейся темы. Отвечают все играющие сразу (на бумажках).
// Ставки тех, кто не играет (счёт не плюсовой), убираем.
export function finalShowQuestion(s: LiveState): LiveState {
  const final = finalOf(s)
  if (!final || !betsReady(s.game, final)) return s
  const theme = remainingThemes(roundById(s.game, s.roundId), final)[0]
  if (!theme) return s
  const bets = Object.fromEntries(participants(s.game, final).map((t) => [t.id, final.bets[t.id]]))
  return {
    ...s,
    final: { ...final, bets, correct: {}, phase: 'question' },
    current: { categoryId: theme.category.id, questionId: theme.question.id },
    slideIndex: 0,
    showAnswer: false,
    answeringTeamId: null,
    triedTeamIds: [],
    timer: newTimer(theme.question.timerSec ?? FINAL_TIMER_SEC),
    video: null,
  }
}

// Ведущий отметил ответ команды в финале: верно / неверно
export function finalMark(s: LiveState, teamId: string, correct: boolean): LiveState {
  const final = finalOf(s)
  return final ? { ...s, final: { ...final, correct: { ...final.correct, [teamId]: correct } } } : s
}

// Итоги финала: счёт по ставкам, вопрос сыгран, зал показывает таблицу и ответ
export function finalReveal(s: LiveState): LiveState {
  const final = finalOf(s)
  if (!final) return s
  const where = `Финал · ${roundById(s.game, s.roundId).categories.find((c) => c.id === s.current?.categoryId)?.title ?? ''}`
  const entries = Object.entries(final.bets).map(([teamId, bet]) => ({
    kind: 'final' as const,
    teamId,
    points: final.correct[teamId] ? bet : -bet,
    questionId: s.current?.questionId,
    where,
    note: `ставка ${bet}, ${final.correct[teamId] ? 'верно' : 'неверно'}`,
  }))
  return {
    ...withPlayed(withLog({ ...s, game: withFinalScores(s.game, final) }, ...entries), s.current),
    final: { ...final, phase: 'results' },
    current: null,
    slideIndex: 0,
    showAnswer: false,
    timer: null,
    video: null,
  }
}
