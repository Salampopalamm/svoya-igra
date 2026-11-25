import type { Game, Question, Team } from './types'

// «Кот в мешке» и аукцион — правила решены владельцем 25.11.2026 (PLAN.md, Этап 6).
//
// Кот: команда, открывшая ячейку, отдаёт вопрос любой команде (можно и себе). В зале сначала заставка
//   «КОТ В МЕШКЕ» и тема, потом сам вопрос. Отвечает только получатель: верно — +цена кота, неверно — −цена,
//   перехвата нет. Ход потом идёт по кругу, как обычно.
// Аукцион: ставки шагом 100, от 100. Предел — 25% от суммы плюсовых счетов (но не меньше цены ячейки).
//   «Торгуются все»: каждая команда ставит или пасует, первой отвечает команда, чей ход (или следующая
//   по кругу со ставкой); ошиблась — минус её ставка и отвечает следующая. «Только чей ход» — перехвата нет.
// Ход партии (кто отвечает, баллы) — в play.ts; здесь — сами правила.

// Кот в мешке в партии: кому отдали (null — ещё не отдали, в зале заставка)
export type CatState = { teamId: string | null }

// Аукцион в партии: сначала ставки, потом вопрос.
// bets: ставка команды; null — пас; нет ключа — ещё не назвала (при старте вопроса считается пасом)
export type AuctionState = { phase: 'bets' | 'question'; bets: Record<string, number | null> }

export const BET_STEP = 100

export const isCat = (q: Question | undefined): boolean => !!q && q.kind === 'cat-in-bag' && !q.tree
export const isAuction = (q: Question | undefined): boolean => !!q && q.kind === 'auction' && !q.tree

// Цена кота: своя у автора, пусто — как в ячейке
export const catValue = (q: Question) => (q.cat?.value && q.cat.value > 0 ? q.cat.value : q.value)

// Торгуются все команды (по умолчанию) или ставит только та, чей ход
export const auctionMode = (q: Question) => q.auction ?? 'all'

const downToStep = (n: number) => Math.floor(n / BET_STEP) * BET_STEP

// Предел ставки P: 25% от суммы плюсовых счетов (минусовые не считаются), вниз до сотни,
// но не меньше цены ячейки — иначе в начале игры, когда у всех 0, ставить было бы нечего
export function auctionLimit(game: Game, q: Question): number {
  const plus = game.teams.reduce((sum, t) => sum + Math.max(0, t.score), 0)
  return Math.max(downToStep(plus * 0.25), q.value)
}

// Сколько может поставить команда: в плюсе — до P, но не больше своего счёта; с нулём — до P;
// в минусе — не больше своего минуса (при −900 — до 900, чтобы выйти в ноль).
// Всё — вниз до сотни; самая маленькая ставка (100) разрешена всегда
export function maxBet(game: Game, q: Question, team: Team): number {
  const limit = auctionLimit(game, q)
  const raw = team.score > 0 ? Math.min(limit, team.score) : team.score === 0 ? limit : -team.score
  return Math.max(BET_STEP, downToStep(raw))
}

// Что не так со ставкой (null — всё хорошо)
export function betProblem(game: Game, q: Question, team: Team, bet: number): string | null {
  const max = maxBet(game, q, team)
  if (!Number.isInteger(bet) || bet < BET_STEP) return `ставка — от ${BET_STEP}`
  if (bet % BET_STEP !== 0) return `ставка — шагом ${BET_STEP}`
  if (bet > max) return `не больше ${max}`
  return null
}

// Кто может делать ставку: все команды или только та, чей ход
export function bidders(game: Game, q: Question, turnTeamId: string | null): Team[] {
  return auctionMode(q) === 'turn' ? game.teams.filter((t) => t.id === turnTeamId) : game.teams
}

// Порядок ответа: по кругу, начиная с команды, чей ход
export function circleFrom(teams: Team[], startId: string | null): Team[] {
  const start = Math.max(0, teams.findIndex((t) => t.id === startId))
  return [...teams.slice(start), ...teams.slice(0, start)]
}

// Команды со ставкой в порядке ответа
export function answerOrder(game: Game, turnTeamId: string | null, bets: Record<string, number | null>): Team[] {
  return circleFrom(game.teams, turnTeamId).filter((t) => typeof bets[t.id] === 'number')
}

// Кто отвечает следующим: первая по кругу со ставкой, которая ещё не ошибалась (null — никого не осталось)
export function nextBidder(
  game: Game,
  turnTeamId: string | null,
  bets: Record<string, number | null>,
  triedTeamIds: string[],
): string | null {
  return answerOrder(game, turnTeamId, bets).find((t) => !triedTeamIds.includes(t.id))?.id ?? null
}

// Ставки, с которыми можно начинать вопрос: только верные ставки тех, кто может ставить; остальные — пас
export function validBets(game: Game, q: Question, turnTeamId: string | null, bets: Record<string, number | null>) {
  const result: Record<string, number | null> = {}
  for (const team of bidders(game, q, turnTeamId)) {
    const bet = bets[team.id]
    result[team.id] = typeof bet === 'number' && !betProblem(game, q, team, bet) ? bet : null
  }
  return result
}

// Почему вопрос аукциона ещё нельзя начать (null — можно)
export function auctionStartProblem(game: Game, q: Question, turnTeamId: string | null, bets: Record<string, number | null>): string | null {
  const teams = bidders(game, q, turnTeamId)
  const wrong = teams.find((t) => typeof bets[t.id] === 'number' && betProblem(game, q, t, bets[t.id] as number))
  if (wrong) return `Поправьте ставку «${wrong.name}»: ${betProblem(game, q, wrong, bets[wrong.id] as number)}`
  if (!teams.some((t) => typeof bets[t.id] === 'number')) {
    return auctionMode(q) === 'turn' ? 'Впишите ставку команды, чей ход' : 'Нужна хотя бы одна ставка'
  }
  return null
}

// Надпись про вид вопроса: «кот в мешке · 600», «аукцион · торгуются все»
export function catAuctionLabel(q: Question): string | null {
  if (isCat(q)) return `кот в мешке · ${catValue(q)}`
  if (isAuction(q)) return auctionMode(q) === 'turn' ? 'аукцион · ставит чей ход' : 'аукцион · торгуются все'
  return null
}

// Без ошибок: цена кота — целое число больше нуля, тема — не пустая строка; пусто — undefined
export function cleanCat(c: { theme?: unknown; value?: unknown } | undefined) {
  if (!c) return undefined
  const result: { theme?: string; value?: number } = {}
  if (typeof c.theme === 'string' && c.theme.trim()) result.theme = c.theme
  if (typeof c.value === 'number' && Number.isInteger(c.value) && c.value > 0) result.value = c.value
  return Object.keys(result).length ? result : undefined
}
