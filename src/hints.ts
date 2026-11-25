import type { Content, Question } from './types'

// Подсказки к вопросу: до трёх, в каждой текст и/или картинки. Автор пишет их в редакторе,
// ведущий во время вопроса по кнопке показывает в зале — подсказка всплывает поверх вопроса.
// Цена подсказки (Question.hintCost) — автор решает, снимать ли баллы: после каждой показанной
// подсказки за верный ответ дают на hintCost меньше (не ниже нуля). Пусто — подсказки бесплатные.
// У ветвящегося вопроса и в финале подсказок нет. Ход партии (показать, убрать) — в play.ts.

export const MAX_HINTS = 3

// Подсказка в партии: сколько уже показали (за них снимаются баллы) и какая сейчас в зале (null — никакая)
export type HintState = { shown: number; open: number | null }

const filled = (c: Content) => !!c.text?.trim() || !!c.media

// Подсказки, которые можно показать: непустые, не у ветвящегося вопроса
export function hintsOf(q: Question | undefined): Content[] {
  if (!q || q.tree) return []
  return (q.hints ?? []).filter(filled)
}

// Сколько баллов меньше за верный ответ, если показано shown подсказок
export function hintPenalty(q: Question, shown: number): number {
  return (q.hintCost ?? 0) * Math.min(shown, hintsOf(q).length)
}

// Цена по умолчанию, когда автор включил «снимать баллы»: половина стоимости, вниз до десятков (не меньше 10)
export const defaultHintCost = (value: number) => Math.max(10, Math.floor(value / 2 / 10) * 10)

// Без ошибок: подсказок не больше трёх, цена — целое число больше нуля; пусто — undefined
export function cleanHintCost(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined
}
