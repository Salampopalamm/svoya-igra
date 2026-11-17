import { allQuestions, hiddenQuestions, isEmptyQuestion, sortByValue } from './game'
import type { Game, Question, Round, Rule, Team } from './types'

// Правила «ЕСЛИ → ТО». Пульт сам следит за условиями и, когда условие выполнилось,
// показывает ведущему плашку «Выполнить / Пропустить». Каждое правило — один раз за игру.
//   ЕСЛИ: команда набрала N баллов · раунд сыгран · вопрос сыгран
//   ТО:   открыть скрытый вопрос · открыть скрытый раунд · показать картинку или видео в зале

export type WhenKind = Rule['when']['kind']
export type ThenKind = 'unlock-question' | 'open-round' | 'show-media' // add-points пока не делаем

export const WHEN_NAMES: Record<WhenKind, string> = {
  'score-reached': 'команда набрала',
  'round-finished': 'сыгран раунд',
  'question-played': 'сыгран вопрос',
}

export const THEN_NAMES: Record<ThenKind, string> = {
  'unlock-question': 'открыть скрытый вопрос',
  'open-round': 'открыть скрытый раунд',
  'show-media': 'показать в зале картинку или видео',
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
  if (when.kind === 'round-finished' && !game.rounds.some((r) => r.id === when.value)) return 'выберите раунд'
  if (when.kind === 'question-played' && !allQuestions(game).some((q) => q.id === when.value)) return 'выберите вопрос'
  if (then.kind === 'unlock-question' && !hiddenQuestions(game).some((h) => h.id === then.target)) {
    return 'выберите скрытый вопрос (сначала отметьте вопрос «Скрытый»)'
  }
  if (then.kind === 'open-round' && !hiddenRounds(game).some((r) => r.id === then.target)) {
    return 'выберите скрытый раунд (сначала отметьте раунд «Скрытый»)'
  }
  if (then.kind === 'show-media' && !then.media) return 'загрузите картинку или видео'
  if (then.kind === 'add-points') return 'это действие пока не поддерживается'
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
export function ruleConditionMet(game: Game, rule: Rule, unlockedIds: string[]): boolean {
  const { when } = rule
  if (when.kind === 'score-reached') return teamsReaching(game, Number(when.value)).length > 0
  if (when.kind === 'round-finished') {
    const round = game.rounds.find((r) => r.id === when.value)
    return !!round && roundFinished(round, unlockedIds)
  }
  return allQuestions(game).some((q) => q.id === when.value && q.played)
}

// Правила, которые пора предложить ведущему: условие выполнилось, правило ещё не выполняли и не пропускали
export function readyRules(game: Game, done: string[], unlockedIds: string[]): Rule[] {
  return game.rules.filter((r) => !done.includes(r.id) && !ruleProblem(game, r) && ruleConditionMet(game, r, unlockedIds))
}

// Правило словами: «ЕСЛИ команда набрала 1000 → ТО открыть скрытый вопрос «Бонус · 500»»
export function describeRule(game: Game, rule: Rule): { when: string; then: string } {
  const { when, then } = rule
  const whenText =
    when.kind === 'score-reached'
      ? `${teamsReaching(game, Number(when.value)).map((t) => `«${t.name}»`).join(', ') || 'команда'} набрала ${when.value}`
      : when.kind === 'round-finished'
        ? `сыгран раунд «${game.rounds.find((r) => r.id === when.value)?.title ?? '?'}»`
        : `сыгран вопрос «${questionLabel(game, String(when.value)) ?? '?'}»`
  const thenText =
    then.kind === 'unlock-question'
      ? `открыть скрытый вопрос «${questionLabel(game, then.target) ?? '?'}»`
      : then.kind === 'open-round'
        ? `открыть скрытый раунд «${game.rounds.find((r) => r.id === then.target)?.title ?? '?'}»`
        : `показать в зале «${then.media?.name ?? '?'}»`
  return { when: whenText, then: thenText }
}
