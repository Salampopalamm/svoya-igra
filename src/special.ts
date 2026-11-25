import { catAuctionLabel, isAuction, isCat } from './catAuction'
import type { Question, Special } from './types'

// Особые вопросы: общая схема «до вопроса → кто отвечает → как считать баллы».
//   Как считать: множитель за верный ответ (×2, ×3) и за неверный (×1 — минус стоимость, ×0 — без минуса).
//   Кто отвечает: команда, чей ход (с перехватом), или все команды сразу — ведущий отмечает каждую.
//   До вопроса: «Кот в мешке» — передать вопрос, аукцион — ставки (правила — catAuction.ts).
// Ветвящийся вопрос, кот, аукцион и финал считают баллы по-своему — особые настройки на них не действуют.

export const MULTIPLIERS = [1, 2, 3] as const

const special = (q: Question): Special => (q.tree || isCat(q) || isAuction(q) ? {} : (q.special ?? {}))

// Сколько получает команда за верный ответ
export const correctPoints = (q: Question) => q.value * (special(q).correct ?? 1)

// Сколько теряет за неверный (число без минуса; 0 — вопрос без минуса)
export const wrongPoints = (q: Question) => q.value * (special(q).wrong ?? 1)

// Отвечают все команды сразу
export const isForAll = (q: Question | undefined) => !!q && !!special(q).forAll

// Без ошибок: множители — только из списка, обычные значения не храним; пусто — undefined
export function cleanSpecial(s: Special | undefined): Special | undefined {
  if (!s) return undefined
  const result: Special = {}
  if (s.correct && s.correct !== 1 && (MULTIPLIERS as readonly number[]).includes(s.correct)) result.correct = s.correct
  if (s.wrong === 0) result.wrong = 0
  if (s.forAll) result.forAll = true
  return Object.keys(result).length ? result : undefined
}

// Подписи особенностей: «×2», «без минуса», «для всех команд», «кот в мешке · 600», «аукцион · торгуются все»
export function specialParts(q: Question): string[] {
  const s = special(q)
  const kind = catAuctionLabel(q)
  const parts: string[] = kind ? [kind] : []
  if (s.correct && s.correct !== 1) parts.push(`×${s.correct}`)
  if (s.wrong === 0) parts.push('без минуса')
  if (s.forAll) parts.push('для всех команд')
  return parts
}

// Заголовок вопроса в зале: «Вопрос для всех команд · ×2», «Кот в мешке · Тема» (обычный — null)
export function specialTitle(q: Question): string | null {
  if (isCat(q)) return ['Кот в мешке', q.cat?.theme?.trim()].filter(Boolean).join(' · ')
  if (isAuction(q)) return 'Аукцион'
  const scoring = specialParts(q).filter((p) => p !== 'для всех команд')
  if (isForAll(q)) return ['Вопрос для всех команд', ...scoring].join(' · ')
  return scoring.length ? `Особый вопрос · ${scoring.join(' · ')}` : null
}
