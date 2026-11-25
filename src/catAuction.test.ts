import { describe, expect, it } from 'vitest'
import { auctionLimit, auctionStartProblem, betProblem, catValue, maxBet, nextBidder } from './catAuction'
import type { LiveState } from './live'
import {
  answerCorrect,
  answerPoints,
  answerWrong,
  auctionSetBet,
  auctionStart,
  closeQuestion,
  freshState,
  openCell,
  selectAnswering,
  viewPlayedCell,
} from './play'
import { specialParts, specialTitle, correctPoints } from './special'
import { cat, game, q, round, team } from './testing'
import type { Question } from './types'

// Партия: одна ячейка, три команды с заданным счётом; ход — у первой
function setup(question: Question, scores = [0, 0, 0]) {
  const category = cat('Кино', [question])
  const s = freshState(game([round([category])], [team('Совы', scores[0]), team('Лисы', scores[1]), team('Ежи', scores[2])]))
  const cell = { categoryId: category.id, questionId: question.id }
  const [a, b, c] = s.game.teams.map((t) => t.id)
  return { s, cell, a, b, c }
}
const scores = (s: LiveState) => s.game.teams.map((t) => t.score)
const played = (s: LiveState) => s.game.rounds[0].categories[0].questions[0].played

describe('кот в мешке', () => {
  const catQ = () => q(200, { kind: 'cat-in-bag', cat: { theme: 'Мультфильмы', value: 500 } })

  it('цена — своя у автора, пусто — как в ячейке', () => {
    expect(catValue(catQ())).toBe(500)
    expect(catValue(q(200, { kind: 'cat-in-bag' }))).toBe(200)
  })

  it('сначала кота отдают: отвечающей команды нет, нажатая команда его получает (можно и себе)', () => {
    const { s, cell, a, b } = setup(catQ())
    const opened = openCell(s, cell)
    expect(opened.answeringTeamId).toBeNull()
    expect(opened.cat).toEqual({ teamId: null })
    expect(answerCorrect(opened, a)).toBe(opened) // пока не отдали — отвечать некому
    const given = selectAnswering(opened, b)
    expect(given.cat).toEqual({ teamId: b })
    expect(given.answeringTeamId).toBe(b)
    expect(selectAnswering(opened, a).cat).toEqual({ teamId: a })
  })

  it('отвечает только получатель: верно — +цена кота, ход идёт по кругу как обычно', () => {
    const { s, cell, a, b, c } = setup(catQ())
    const given = selectAnswering(openCell(s, cell), c)
    expect(selectAnswering(given, a)).toBe(given) // другую команду выбрать нельзя
    expect(answerCorrect(given, a)).toBe(given)
    const done = answerCorrect(given, c)
    expect(scores(done)).toEqual([0, 0, 500])
    expect(played(done)).toBe(true)
    expect(done.turnTeamId).toBe(b) // ход был у Сов — переходит к Лисам, а не к получателю
    expect(done.cat).toBeNull()
    expect(done.log?.at(-1)).toMatchObject({ kind: 'correct', points: 500, note: 'кот в мешке' })
  })

  it('неверно — −цена кота, перехвата нет', () => {
    const { s, cell, a, b } = setup(catQ())
    const wrong = answerWrong(selectAnswering(openCell(s, cell), b), b)
    expect(scores(wrong)).toEqual([0, -500, 0])
    expect(wrong.answeringTeamId).toBeNull()
    expect(selectAnswering(wrong, a)).toBe(wrong) // перехватить нельзя
    expect(answerCorrect(wrong, a)).toBe(wrong)
    expect(played(closeQuestion(wrong))).toBe(true)
  })

  it('особые настройки (×2, для всех) на кота не действуют', () => {
    const question = q(200, { kind: 'cat-in-bag', special: { correct: 2, forAll: true } })
    expect(correctPoints(question)).toBe(200)
    expect(specialParts(question)).toEqual(['кот в мешке · 200'])
    expect(specialTitle(question)).toBe('Кот в мешке')
    expect(specialTitle(catQ())).toBe('Кот в мешке · Мультфильмы')
  })

  it('сыгранного кота открыли посмотреть — его не отдают', () => {
    const { s, cell, a } = setup(catQ())
    const view = viewPlayedCell(s, cell)
    expect(view.cat).toBeNull()
    expect(selectAnswering(view, a)).toBe(view)
  })
})

describe('аукцион: пределы ставок', () => {
  const g = (scoresList: number[]) => setup(q(300, { kind: 'auction' }), scoresList)

  it('в начале игры, когда у всех 0, предел — цена ячейки', () => {
    const { s } = g([0, 0, 0])
    const question = s.game.rounds[0].categories[0].questions[0]
    expect(auctionLimit(s.game, question)).toBe(300)
    expect(maxBet(s.game, question, s.game.teams[0])).toBe(300)
  })

  it('предел — 25% суммы плюсовых счетов вниз до сотни; минусовые не считаются', () => {
    const { s } = g([2000, 1700, -900])
    const question = s.game.rounds[0].categories[0].questions[0]
    expect(auctionLimit(s.game, question)).toBe(900) // 25% от 3700 = 925 → 900
    expect(maxBet(s.game, question, s.game.teams[0])).toBe(900) // в плюсе: до предела
    expect(maxBet(s.game, question, s.game.teams[2])).toBe(900) // в минусе: до своего минуса
  })

  it('команда в плюсе — не больше своего счёта, в минусе — не больше минуса', () => {
    const { s } = g([4000, 450, -1300])
    const question = s.game.rounds[0].categories[0].questions[0]
    expect(maxBet(s.game, question, s.game.teams[1])).toBe(400) // счёт 450 → 400
    expect(maxBet(s.game, question, s.game.teams[2])).toBe(1300) // чтобы выйти в ноль
  })

  it('ставка — от 100, шагом 100, не больше предела', () => {
    const { s } = g([0, 0, 0])
    const question = s.game.rounds[0].categories[0].questions[0]
    const t = s.game.teams[0]
    expect(betProblem(s.game, question, t, 100)).toBeNull()
    expect(betProblem(s.game, question, t, 50)).toBe('ставка — от 100')
    expect(betProblem(s.game, question, t, 250)).toBe('ставка — шагом 100')
    expect(betProblem(s.game, question, t, 400)).toBe('не больше 300')
  })
})

describe('аукцион: торгуются все', () => {
  const auctionQ = () => q(100, { kind: 'auction' })

  it('сначала ставки: отвечать нельзя, пока вопрос не начат', () => {
    const { s, cell, a } = setup(auctionQ(), [1000, 1000, 1000])
    const opened = openCell(s, cell)
    expect(opened.auction).toEqual({ phase: 'bets', bets: {} })
    expect(opened.answeringTeamId).toBeNull()
    const bet = auctionSetBet(opened, a, 500)
    expect(selectAnswering(bet, a)).toBe(bet)
    expect(answerCorrect(bet, a)).toBe(bet)
  })

  it('без ставок начать нельзя; неверная ставка мешает начать', () => {
    const { s, cell, a } = setup(auctionQ(), [1000, 1000, 1000])
    const opened = openCell(s, cell)
    const question = s.game.rounds[0].categories[0].questions[0]
    expect(auctionStart(opened)).toBe(opened)
    expect(auctionStartProblem(s.game, question, a, {})).toBe('Нужна хотя бы одна ставка')
    const tooBig = auctionSetBet(opened, a, 5000)
    expect(auctionStart(tooBig)).toBe(tooBig)
  })

  it('первой отвечает команда, чей ход; неверно — минус ставка и отвечает следующая по кругу со своей ставкой', () => {
    const { s, cell, a, b, c } = setup(auctionQ(), [1000, 1000, 1000])
    let st = openCell(s, cell)
    st = auctionSetBet(st, a, 300)
    st = auctionSetBet(st, b, null) // пас
    st = auctionSetBet(st, c, 700)
    st = auctionStart(st)
    expect(st.auction?.phase).toBe('question')
    expect(st.answeringTeamId).toBe(a)
    expect(answerPoints(st, a)).toEqual({ plus: 300, minus: 300 })
    st = answerWrong(st, a)
    expect(scores(st)).toEqual([700, 1000, 1000])
    expect(st.answeringTeamId).toBe(c) // Лисы спасовали — отвечают Ежи
    expect(selectAnswering(st, b)).toBe(st) // без ставки отвечать нельзя
    st = answerCorrect(st, c)
    expect(scores(st)).toEqual([700, 1000, 1700])
    expect(played(st)).toBe(true)
    expect(st.auction).toBeNull()
    expect(st.turnTeamId).toBe(b)
    expect(st.log?.at(-1)).toMatchObject({ kind: 'correct', points: 700, note: 'аукцион, ставка 700' })
  })

  it('команда, чей ход, спасовала — первой отвечает следующая со ставкой; ошиблись все — отвечать некому', () => {
    const { s, cell, a, b, c } = setup(auctionQ(), [1000, 1000, 1000])
    let st = openCell(s, cell)
    st = auctionSetBet(st, c, 200)
    st = auctionSetBet(st, b, 100)
    st = auctionStart(st)
    expect(st.answeringTeamId).toBe(b) // у Сов ставки нет (пас), по кругу — Лисы
    st = answerWrong(answerWrong(st, b), c)
    expect(scores(st)).toEqual([1000, 900, 800])
    expect(st.answeringTeamId).toBeNull()
    expect(answerCorrect(st, a)).toBe(st)
  })

  it('по кругу считаем от команды, чей ход', () => {
    const { s, a, b, c } = setup(auctionQ())
    expect(nextBidder(s.game, b, { [a]: 100, [b]: null, [c]: 100 }, [])).toBe(c)
    expect(nextBidder(s.game, c, { [a]: 100, [b]: 100, [c]: 100 }, [c])).toBe(a)
  })
})

describe('аукцион: ставит только чей ход', () => {
  it('ставку делает только команда, чей ход; неверно — минус ставка, перехвата нет', () => {
    const { s, cell, a, b } = setup(q(200, { kind: 'auction', auction: 'turn' }), [800, 0, 0])
    let st = openCell(s, cell)
    const question = s.game.rounds[0].categories[0].questions[0]
    expect(auctionStartProblem(s.game, question, a, {})).toBe('Впишите ставку команды, чей ход')
    st = auctionSetBet(st, b, 200) // ставка чужой команды не считается
    expect(auctionStart(st)).toBe(st)
    st = auctionStart(auctionSetBet(st, a, 200))
    expect(st.auction?.bets).toEqual({ [a]: 200 })
    expect(st.answeringTeamId).toBe(a)
    st = answerWrong(st, a)
    expect(scores(st)).toEqual([600, 0, 0])
    expect(st.answeringTeamId).toBeNull()
    expect(selectAnswering(st, b)).toBe(st)
  })
})
