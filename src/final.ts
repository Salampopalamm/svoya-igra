import { isEmptyQuestion, sortByValue } from './game'
import type { FinalState } from './live'
import type { Category, Game, Question, Round, Team } from './types'

// Финальный раунд: каждая категория — тема с одним вопросом.
// Ход финала: команды по очереди убирают темы (начинает отстающая) → команды с плюсовым счётом
// делают ставки (от 1 до своего счёта) → вопрос → ведущий отмечает, кто ответил верно →
// итоги раскрываются в зале все сразу: верно — плюс ставка, неверно — минус ставка.

export type FinalTheme = { category: Category; question: Question }

export const FINAL_TIMER_SEC = 60 // время на ответ в финале, если у вопроса не задано своё

// Темы финала: категории, где есть заполненный вопрос (берём самый дешёвый заполненный)
export function finalThemes(round: Round): FinalTheme[] {
  return round.categories.flatMap((category) => {
    const question = sortByValue(category.questions).find((q) => !isEmptyQuestion(q))
    return question ? [{ category, question }] : []
  })
}

// Состояние финала для раунда: сохранённое или новое (если финал ещё не начинали)
export function finalStateOf(saved: FinalState | null | undefined, round: Round): FinalState {
  if (saved && saved.roundId === round.id) return saved
  return {
    roundId: round.id,
    phase: finalThemes(round).length > 1 ? 'themes' : 'bets',
    removedIds: [],
    bets: {},
    correct: {},
  }
}

// Темы, которые ещё не убрали
export function remainingThemes(round: Round, final: FinalState): FinalTheme[] {
  return finalThemes(round).filter((t) => !final.removedIds.includes(t.category.id))
}

// Порядок убирания тем: от меньшего счёта к большему (при равном — как команды стоят в игре)
export function removalOrder(game: Game): Team[] {
  return [...game.teams].sort((a, b) => a.score - b.score)
}

// Какая команда сейчас убирает тему
export function remover(game: Game, final: FinalState): Team | undefined {
  const order = removalOrder(game)
  return order.length > 0 ? order[final.removedIds.length % order.length] : undefined
}

// Убрать тему. Осталась одна — пора делать ставки.
export function removeTheme(round: Round, final: FinalState, categoryId: string): FinalState {
  if (final.phase !== 'themes' || final.removedIds.includes(categoryId)) return final
  const next = { ...final, removedIds: [...final.removedIds, categoryId] }
  return remainingThemes(round, next).length <= 1 ? { ...next, phase: 'bets' } : next
}

// Кто играет финал. Пока ставки не сделаны — команды с плюсовым счётом; потом — те, кто поставил.
export function participants(game: Game, final: FinalState): Team[] {
  if (final.phase === 'themes' || final.phase === 'bets') return game.teams.filter((t) => t.score > 0)
  return game.teams.filter((t) => final.bets[t.id] !== undefined)
}

// Ставка подходит: целое число от 1 до счёта команды
export function isValidBet(team: Team, bet: number | undefined): boolean {
  return bet !== undefined && Number.isInteger(bet) && bet >= 1 && bet <= team.score
}

// Все ли играющие команды сделали ставку
export function betsReady(game: Game, final: FinalState): boolean {
  return participants(game, final).every((t) => isValidBet(t, final.bets[t.id]))
}

// Счёт после финала: верно — плюс ставка, неверно — минус ставка
export function withFinalScores(game: Game, final: FinalState): Game {
  return {
    ...game,
    teams: game.teams.map((t) => {
      const bet = final.bets[t.id]
      if (bet === undefined) return t
      return { ...t, score: t.score + (final.correct[t.id] ? bet : -bet) }
    }),
  }
}
