import { allQuestions, hiddenQuestions, isEmptyQuestion, sortByValue } from './game'
import { wrongStreak, type LogEntry } from './log'
import type { Category, Game, Question, Round, Rule, Team } from './types'

// Правила «ЕСЛИ → ТО». Пульт сам следит за условиями и, когда условие выполнилось,
// показывает ведущему плашку «Выполнить / Пропустить». Каждое правило — один раз за игру.
//   ЕСЛИ: команда набрала N баллов · команда ошиблась N раз подряд · команда отстаёт от лидера на N ·
//         раунд сыгран · категория сыграна · вопрос сыгран
//   ТО:   открыть скрытый вопрос · открыть скрытый раунд · показать картинку или видео в зале ·
//         показать надпись в зале · дать баллы команде · передать ход команде
// «Команда из условия» — та, что набрала, ошиблась или отстаёт (у условий про раунд и вопрос её нет).

export type WhenKind = Rule['when']['kind']
export type ThenKind = Rule['then']['kind']
export type TeamTarget = 'trigger' | 'leader' | 'last'

export const WHEN_NAMES: Record<WhenKind, string> = {
  'score-reached': 'команда набрала',
  'wrong-streak': 'команда ошиблась подряд',
  behind: 'команда отстаёт от лидера на',
  'round-finished': 'сыгран раунд',
  'category-played': 'сыграна категория',
  'question-played': 'сыгран вопрос',
}

export const THEN_NAMES: Record<ThenKind, string> = {
  'unlock-question': 'открыть скрытый вопрос',
  'open-round': 'открыть скрытый раунд',
  'show-media': 'показать в зале картинку или видео',
  'show-text': 'показать в зале надпись',
  'add-points': 'дать баллы',
  'give-turn': 'передать ход',
}

export const TARGET_NAMES: Record<TeamTarget, string> = {
  trigger: 'команде из условия',
  leader: 'лидеру',
  last: 'отстающей команде',
}

// Условия, у которых есть «своя» команда — та, что набрала, ошиблась или отстаёт
export const hasTriggerTeam = (kind: WhenKind) => kind === 'score-reached' || kind === 'wrong-streak' || kind === 'behind'

// Действия, которым нужна команда
export const needsTeam = (kind: ThenKind) => kind === 'add-points' || kind === 'give-turn'

const isTarget = (v: string): v is TeamTarget => v in TARGET_NAMES

// Лидер и отстающая: при равенстве — первая по списку
export const leader = (game: Game): Team | undefined =>
  game.teams.reduce<Team | undefined>((best, t) => (!best || t.score > best.score ? t : best), undefined)
export const lastTeam = (game: Game): Team | undefined =>
  game.teams.reduce<Team | undefined>((worst, t) => (!worst || t.score < worst.score ? t : worst), undefined)

// Команды, для которых условие выполнено (у условий без своей команды — пусто)
export function triggerTeams(game: Game, rule: Rule, log: LogEntry[] = []): Team[] {
  const { when } = rule
  const n = Number(when.value)
  if (when.kind === 'score-reached') return teamsReaching(game, n).sort((a, b) => b.score - a.score)
  if (when.kind === 'wrong-streak') return game.teams.filter((t) => wrongStreak(log, t.id) >= n)
  if (when.kind === 'behind') {
    const top = leader(game)?.score ?? 0
    return game.teams.filter((t) => top - t.score >= n).sort((a, b) => a.score - b.score)
  }
  return []
}

// Кому действие правила: команде из условия (первой из подходящих), лидеру или отстающей
export function targetTeam(game: Game, rule: Rule, log: LogEntry[] = []): Team | undefined {
  const target = rule.then.target
  if (target === 'leader') return leader(game)
  if (target === 'last') return lastTeam(game)
  if (target === 'trigger') return triggerTeams(game, rule, log)[0]
  return undefined
}

// Категории обычных раундов — для условия «сыграна категория»: «Раунд 1 · География»
export function categoryChoices(game: Game): { id: string; label: string }[] {
  return game.rounds
    .filter((r) => r.kind !== 'final')
    .flatMap((r) => r.categories.map((c) => ({ id: c.id, label: (game.rounds.length > 1 ? r.title + ' · ' : '') + c.title })))
}

function findCategory(game: Game, id: string): Category | undefined {
  return game.rounds.flatMap((r) => r.categories).find((c) => c.id === id)
}

export function newRule(): Rule {
  return { id: crypto.randomUUID(), when: { kind: 'score-reached', value: 1000 }, then: { kind: 'unlock-question', target: '' } }
}

// Подпись вопроса: «Раунд · Категория · 400»
export function questionLabel(game: Game, questionId: string): string | undefined {
  for (const r of game.rounds) {
    for (const c of r.categories) {
      const q = c.questions.find((x) => x.id === questionId)
      if (q) return `${game.rounds.length > 1 ? `${r.title} · ` : ''}${c.title} · ${q.value}`
    }
  }
  return undefined
}

// Вопросы, которые можно выбрать в «сыгран вопрос»: заполненные, в обычных раундах
export function playableQuestions(game: Game): { id: string; label: string }[] {
  return game.rounds
    .filter((r) => r.kind !== 'final')
    .flatMap((r) =>
      r.categories.flatMap((c) =>
        sortByValue(c.questions)
          .filter((q) => !isEmptyQuestion(q))
          .map((q) => ({ id: q.id, label: questionLabel(game, q.id)! })),
      ),
    )
}

export const hiddenRounds = (game: Game): Round[] => game.rounds.filter((r) => r.hidden)

// Что не так с правилом (не выбрано, на что смотреть, или цель удалили)
export function ruleProblem(game: Game, rule: Rule): string | null {
  const { when, then } = rule
  if (when.kind === 'score-reached' && !(Number(when.value) > 0)) return 'укажите, сколько баллов'
  if (when.kind === 'wrong-streak' && !(Number(when.value) >= 1)) return 'укажите, сколько ошибок подряд'
  if (when.kind === 'behind' && !(Number(when.value) > 0)) return 'укажите, на сколько баллов отстаёт'
  if (when.kind === 'category-played' && !findCategory(game, String(when.value))) return 'выберите категорию'
  if (when.kind === 'round-finished' && !game.rounds.some((r) => r.id === when.value)) return 'выберите раунд'
  if (when.kind === 'question-played' && !allQuestions(game).some((q) => q.id === when.value)) return 'выберите вопрос'
  if (then.kind === 'unlock-question' && !hiddenQuestions(game).some((h) => h.id === then.target)) {
    return 'выберите скрытый вопрос (сначала отметьте вопрос «Скрытый»)'
  }
  if (then.kind === 'open-round' && !hiddenRounds(game).some((r) => r.id === then.target)) {
    return 'выберите скрытый раунд (сначала отметьте раунд «Скрытый»)'
  }
  if (then.kind === 'show-media' && !then.media) return 'загрузите картинку или видео'
  if (then.kind === 'show-text' && !then.text?.trim()) return 'впишите надпись'
  if (then.kind === 'add-points' && !then.points) return 'укажите, сколько баллов дать'
  if (needsTeam(then.kind)) {
    if (!isTarget(then.target)) return 'выберите, какой команде'
    if (then.target === 'trigger' && !hasTriggerTeam(when.kind)) {
      return 'у этого условия нет своей команды — выберите лидера или отстающую'
    }
  }
  return null
}

// Сыгран ли раунд: все заполненные вопросы сыграны (закрытые скрытые вопросы не считаем — их могли так и не открыть)
function roundFinished(round: Round, unlockedIds: string[]): boolean {
  const questions: Question[] = round.categories
    .flatMap((c) => c.questions)
    .filter((q) => !isEmptyQuestion(q) && (!q.hidden || unlockedIds.includes(q.id)))
  return questions.length > 0 && questions.every((q) => q.played)
}

// Команды, набравшие нужный счёт (для подписи «Команда 2 набрала 1000»)
export function teamsReaching(game: Game, score: number): Team[] {
  return game.teams.filter((t) => t.score >= score)
}

// Выполнилось ли условие правила прямо сейчас
export function ruleConditionMet(game: Game, rule: Rule, unlockedIds: string[], log: LogEntry[] = []): boolean {
  const { when } = rule
  if (hasTriggerTeam(when.kind)) return triggerTeams(game, rule, log).length > 0
  if (when.kind === 'round-finished') {
    const round = game.rounds.find((r) => r.id === when.value)
    return !!round && roundFinished(round, unlockedIds)
  }
  if (when.kind === 'category-played') {
    const category = findCategory(game, String(when.value))
    return !!category && roundFinished({ id: '', title: '', kind: 'standard', categories: [category] }, unlockedIds)
  }
  return allQuestions(game).some((q) => q.id === when.value && q.played)
}

// Правила, которые пора предложить ведущему: условие выполнилось, правило ещё не выполняли и не пропускали
export function readyRules(game: Game, done: string[], unlockedIds: string[], log: LogEntry[] = []): Rule[] {
  return game.rules.filter((r) => !done.includes(r.id) && !ruleProblem(game, r) && ruleConditionMet(game, r, unlockedIds, log))
}

// Правило словами: «ЕСЛИ команда набрала 1000 → ТО открыть скрытый вопрос «Бонус · 500»»
export function describeRule(game: Game, rule: Rule, log: LogEntry[] = []): { when: string; then: string } {
  const { when, then } = rule
  const teams = triggerTeams(game, rule, log)
  const names = teams.map((t) => '«' + t.name + '»').join(', ') || 'команда'
  const n = Number(when.value)
  const whenText: Record<WhenKind, () => string> = {
    'score-reached': () => names + ' набрала ' + when.value,
    'wrong-streak': () => names + (teams.length > 1 ? ' ошиблись ' : ' ошиблась ') + n + ' ' + times(n) + ' подряд',
    behind: () => names + ' отстаёт от лидера на ' + when.value + ' и больше',
    'round-finished': () => 'сыгран раунд «' + (game.rounds.find((r) => r.id === when.value)?.title ?? '?') + '»',
    'category-played': () => 'сыграна категория «' + (findCategory(game, String(when.value))?.title ?? '?') + '»',
    'question-played': () => 'сыгран вопрос «' + (questionLabel(game, String(when.value)) ?? '?') + '»',
  }
  const team = targetTeam(game, rule, log)
  const whom = team ? '«' + team.name + '»' : isTarget(then.target) ? TARGET_NAMES[then.target] : '?'
  const points = then.points ?? 0
  const thenText: Record<ThenKind, () => string> = {
    'unlock-question': () => 'открыть скрытый вопрос «' + (questionLabel(game, then.target) ?? '?') + '»',
    'open-round': () => 'открыть скрытый раунд «' + (game.rounds.find((r) => r.id === then.target)?.title ?? '?') + '»',
    'show-media': () => 'показать в зале «' + (then.media?.name ?? '?') + '»',
    'show-text': () => 'показать в зале надпись «' + (then.text ?? '') + '»',
    'add-points': () => (points >= 0 ? 'дать ' : 'отнять ') + Math.abs(points) + ' ' + whom,
    'give-turn': () => 'передать ход ' + whom,
  }
  return { when: whenText[when.kind](), then: thenText[then.kind]() }
}

// 1 раз, 2 раза, 5 раз
function times(n: number): string {
  const tens = n % 100
  if (n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14)) return 'раза'
  return 'раз'
}
