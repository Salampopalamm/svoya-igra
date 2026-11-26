import { circleFrom } from './catAuction'
import { isEmptyQuestion } from './game'
import { plural } from './plural'
import type { Game, PlayRules, Question, Round } from './types'

// Баланс: чтобы одна команда не отрывалась слишком сильно (выбор владельца 26.11.2026).
// 1) Новый раунд начинает отстающая команда (настройка Game.playRules.roundStart, по умолчанию — да).
// 2) Перехват — за полную стоимость или за половину (playRules.steal, по умолчанию — полная).
// 3) Цены растут от раунда к раунду: новый раунд N получает номиналы ×N, в редакторе — «Цены ×2 / ÷2».
// 4) Проверка баланса в редакторе — советы, не ошибки (balanceNotes).
// Ход партии (кто начинает раунд, сколько за перехват) — в play.ts.

// ---- Правила партии ----

export const roundStartsWithLast = (game: Game) => game.playRules?.roundStart !== 'continue'
export const stealIsHalf = (game: Game) => game.playRules?.steal === 'half'

// Половина стоимости (перехват за половину)
export const half = (points: number) => Math.round(points / 2)

// Отстающая команда — та, что начнёт новый раунд. При равенстве — первая по кругу от команды, чей ход.
export function laggingTeamId(game: Game, turnTeamId: string | null): string | null {
  const order = circleFrom(game.teams, turnTeamId)
  if (order.length === 0) return null
  return order.reduce((low, t) => (t.score < low.score ? t : low)).id
}

// Без ошибок: только известные значения; пусто — undefined
export function cleanPlayRules(v: unknown): PlayRules | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const raw = v as Record<string, unknown>
  const result: PlayRules = {}
  if (raw.roundStart === 'continue') result.roundStart = 'continue'
  if (raw.steal === 'half') result.steal = 'half'
  return Object.keys(result).length ? result : undefined
}

// ---- Цены по раундам ----

// Цены вопроса ×factor (вместе с ценой кота и ценой подсказки); вниз до десятков, не меньше 10
const scaled = (n: number, factor: number) => Math.max(10, Math.round((n * factor) / 10) * 10)
function scaleQuestion(q: Question, factor: number): Question {
  const next: Question = { ...q, value: scaled(q.value, factor) }
  if (q.cat?.value) next.cat = { ...q.cat, value: scaled(q.cat.value, factor) }
  if (q.hintCost) next.hintCost = scaled(q.hintCost, factor)
  return next
}

// Все цены раунда ×factor (×2 — поднять, ×0.5 — опустить)
export function scaleRound(round: Round, factor: number): Round {
  return {
    ...round,
    categories: round.categories.map((c) => ({ ...c, questions: c.questions.map((q) => scaleQuestion(q, factor)) })),
  }
}

// Средняя цена заполненных вопросов раунда (если заполненных нет — всех); 0 — вопросов нет
function averageValue(round: Round): number {
  const all = round.categories.flatMap((c) => c.questions)
  const filled = all.filter((q) => !isEmptyQuestion(q))
  const list = filled.length ? filled : all
  return list.length ? list.reduce((sum, q) => sum + q.value, 0) / list.length : 0
}

// ---- Проверка баланса ----

export type BalanceNote = {
  roundId?: string
  categoryId?: string
  text: string
  scaleUp?: boolean // совет поднять цены раунда — в редакторе кнопка «Цены ×2»
}

// Особый вопрос: ×2 / ×3, без минуса, для всех, кот, аукцион
const isSpecial = (q: Question) => q.kind !== 'normal' || !!q.special

// Сколько раз сыграет каждая команда: вопросы, которые точно будут на табло (заполненные, не скрытые)
const playable = (rounds: Round[]) =>
  rounds.flatMap((r) => r.categories.flatMap((c) => c.questions)).filter((q) => !isEmptyQuestion(q) && !q.hidden).length

const questions = (n: number) => `${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')}`
const times = (n: number) => `${n} ${plural(n, 'раз', 'раза', 'раз')}`

// Совет про равное число ходов: count вопросов на teams команд
function turnsNote(count: number, teams: number, where: string): string | null {
  const extra = count % teams
  if (count === 0 || extra === 0) return null
  const most = Math.ceil(count / teams)
  const who = extra === 1 ? 'одна команда сходит' : `${extra} ${plural(extra, 'команда', 'команды', 'команд')} сходят`
  return (
    `${where} ${questions(count)} на ${teams} ${plural(teams, 'команду', 'команды', 'команд')}: ${who} ${times(most)}, ` +
    `остальные — ${times(most - 1)}. Чтобы ходов было поровну, добавьте ${questions(teams - extra)} или уберите ${questions(extra)}`
  )
}

// Советы по балансу игры (не ошибки — играть можно и так)
export function balanceNotes(game: Game): BalanceNote[] {
  const notes: BalanceNote[] = []
  const standard = game.rounds.filter((r) => r.kind !== 'final')
  const teams = game.teams.length

  // 1) Ходов поровну. Если раунд начинает отстающая — считаем каждый раунд отдельно, иначе — всю игру.
  if (teams >= 2) {
    if (roundStartsWithLast(game)) {
      for (const round of standard) {
        const text = turnsNote(playable([round]), teams, standard.length > 1 ? 'в раунде' : 'в игре')
        if (text) notes.push({ roundId: round.id, text })
      }
    } else {
      const text = turnsNote(playable(standard), teams, 'в игре')
      if (text) notes.push({ text })
    }
  }

  // 2) Не больше одного особого вопроса в категории — так меньше случайности (совет авторов пакетов SIGame)
  for (const round of standard) {
    for (const category of round.categories) {
      const count = category.questions.filter((q) => isSpecial(q) && !isEmptyQuestion(q)).length
      if (count > 1) {
        notes.push({
          roundId: round.id,
          categoryId: category.id,
          text: `${count} ${plural(count, 'особый вопрос', 'особых вопроса', 'особых вопросов')} в одной категории (×2, кот, аукцион…) — лучше не больше одного: меньше случайности`,
        })
      }
    }
  }

  // 3) Цены растут от раунда к раунду — иначе отставшим нечем догнать
  for (let i = 1; i < standard.length; i++) {
    const before = averageValue(standard[i - 1])
    const now = averageValue(standard[i])
    if (now > 0 && before > 0 && now <= before) {
      notes.push({
        roundId: standard[i].id,
        text: `цены не выше, чем в «${standard[i - 1].title}» — отставшим трудно догнать. Обычно каждый следующий раунд дороже`,
        scaleUp: true,
      })
    }
  }
  return notes
}
