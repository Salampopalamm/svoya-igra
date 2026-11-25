import { describe, expect, it } from 'vitest'
import {
  betsReady,
  finalStateOf,
  finalThemes,
  isValidBet,
  participants,
  remainingThemes,
  removeTheme,
  remover,
  withFinalScores,
} from './final'
import type { FinalState } from './live'
import { cat, emptyQ, game, q, round, team } from './testing'

const finalRound = () =>
  round(
    [cat('Кино', [emptyQ(100), q(300), q(200)]), cat('Пустая', [emptyQ(100)]), cat('Музыка', [q(100)]), cat('Спорт', [q(100)])],
    { kind: 'final' },
  )

describe('темы финала', () => {
  it('берётся самый дешёвый заполненный вопрос, пустые категории пропускаются', () => {
    const themes = finalThemes(finalRound())
    expect(themes.map((t) => t.category.title)).toEqual(['Кино', 'Музыка', 'Спорт'])
    expect(themes[0].question.value).toBe(200)
  })
  it('одна тема — сразу ставки, несколько — сначала убирают темы', () => {
    expect(finalStateOf(null, finalRound()).phase).toBe('themes')
    expect(finalStateOf(null, round([cat('Одна', [q(100)])], { kind: 'final' })).phase).toBe('bets')
  })
  it('сохранённый ход финала этого раунда продолжается, чужого — нет', () => {
    const r = finalRound()
    const saved: FinalState = { roundId: r.id, phase: 'question', removedIds: [], bets: {}, correct: {} }
    expect(finalStateOf(saved, r)).toBe(saved)
    expect(finalStateOf({ ...saved, roundId: 'другой' }, r).phase).toBe('themes')
  })
})

describe('убирание тем', () => {
  it('убирают по очереди, начиная с отстающей; осталась одна тема — ставки', () => {
    const r = finalRound()
    const g = game([r], [team('Лидер', 500), team('Отстающая', 100), team('Середина', 300)])
    let f = finalStateOf(null, r)
    expect(remover(g, f)!.name).toBe('Отстающая')
    f = removeTheme(r, f, r.categories[0].id)
    expect(remover(g, f)!.name).toBe('Середина')
    expect(f.phase).toBe('themes')
    f = removeTheme(r, f, r.categories[2].id)
    expect(f.phase).toBe('bets')
    expect(remainingThemes(r, f).map((t) => t.category.title)).toEqual(['Спорт'])
  })
  it('одну тему дважды не убирают', () => {
    const r = finalRound()
    const f = removeTheme(r, finalStateOf(null, r), r.categories[0].id)
    expect(removeTheme(r, f, r.categories[0].id)).toBe(f)
  })
})

describe('ставки и итоги', () => {
  const r = finalRound()
  const [plus, zero, minus] = [team('Плюс', 300), team('Ноль', 0), team('Минус', -100)]
  const g = game([r], [plus, zero, minus])
  const bets: FinalState = { roundId: r.id, phase: 'bets', removedIds: [], bets: {}, correct: {} }

  it('ставят только команды с плюсовым счётом', () => {
    expect(participants(g, bets).map((t) => t.name)).toEqual(['Плюс'])
  })
  it('ставка — целое от 1 до своего счёта', () => {
    expect([0, 1, 300, 301, 2.5, undefined].map((b) => isValidBet(plus, b))).toEqual([false, true, true, false, false, false])
  })
  it('ставки готовы, когда поставили все играющие', () => {
    expect(betsReady(g, bets)).toBe(false)
    expect(betsReady(g, { ...bets, bets: { [plus.id]: 200 } })).toBe(true)
  })
  it('верно — плюс ставка, неверно — минус ставка, без ставки — счёт как был', () => {
    const two = game([r], [team('А', 300), team('Б', 200), team('В', 50)])
    const [a, b] = two.teams
    const result = withFinalScores(two, { ...bets, phase: 'results', bets: { [a.id]: 100, [b.id]: 200 }, correct: { [a.id]: true } })
    expect(result.teams.map((t) => t.score)).toEqual([400, 0, 50])
  })
})
