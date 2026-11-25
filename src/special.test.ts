import { describe, expect, it } from 'vitest'
import type { LiveState } from './live'
import { answerCorrect, answerWrong, closeQuestion, freshState, markAll, openCell, revealAll, selectAnswering } from './play'
import { repairGame } from './repairGame'
import { cleanSpecial, specialParts, specialTitle } from './special'
import { cat, game, q, round, step, team, tree } from './testing'
import type { Question } from './types'

function setup(question: Question) {
  const category = cat('География', [question])
  const s = freshState(game([round([category])], [team('Совы'), team('Лисы'), team('Ежи')]))
  const cell = { categoryId: category.id, questionId: question.id }
  const [a, b, c] = s.game.teams.map((t) => t.id)
  return { s: openCell(s, cell), a, b, c }
}
const scores = (s: LiveState) => s.game.teams.map((t) => t.score)

describe('особые вопросы', () => {
  it('×2: верно — двойная стоимость; неверно — обычный минус', () => {
    const { s, a, b } = setup(q(300, { special: { correct: 2 } }))
    expect(scores(answerCorrect(s, a))).toEqual([600, 0, 0])
    expect(scores(answerWrong(s, a))).toEqual([-300, 0, 0])
    expect(answerCorrect(selectAnswering(answerWrong(s, a), b), b).log?.at(-1)?.points).toBe(600) // перехват — тоже ×2
  })
  it('без минуса: неверно — 0, но перехват всё равно возможен', () => {
    const { s, a, b } = setup(q(300, { special: { wrong: 0 } }))
    const wrong = answerWrong(s, a)
    expect(scores(wrong)).toEqual([0, 0, 0])
    expect(wrong.triedTeamIds).toEqual([a])
    expect(scores(answerCorrect(selectAnswering(wrong, b), b))).toEqual([0, 300, 0])
  })
  it('для всех команд: никто не «отвечает» по очереди, ведущий отмечает каждую и подводит итог', () => {
    const { s, a, b, c } = setup(q(200, { special: { forAll: true, wrong: 0 } }))
    expect(s.answeringTeamId).toBeNull()
    expect(answerCorrect(s, a)).toBe(s) // обычные «Верно / Неверно» не работают
    expect(selectAnswering(s, a)).toBe(s)
    let st = markAll(markAll(s, a, true), b, false)
    st = markAll(markAll(st, c, true), c, true) // отметили и сняли — Ежи не ответили
    expect(st.marks).toEqual({ [a]: true, [b]: false })
    const done = revealAll(st)
    expect(scores(done)).toEqual([200, 0, 0])
    expect(done.current).toBeNull()
    expect(done.log?.map((e) => [e.kind, e.teamId, e.points])).toEqual([
      ['correct', a, 200],
      ['wrong', b, 0],
    ])
  })
  it('для всех команд ×3 с минусом; никого не отметили — «никто не ответил»', () => {
    const { s, a, b } = setup(q(100, { special: { forAll: true, correct: 3 } }))
    expect(scores(revealAll(markAll(markAll(s, a, true), b, false)))).toEqual([300, -100, 0])
    expect(revealAll(s).log?.map((e) => e.kind)).toEqual(['nobody'])
    expect(closeQuestion(markAll(s, a, true)).game.teams[0].score).toBe(0) // закрыли без итога — баллов нет
  })
  it('у ветвящегося вопроса особые настройки не действуют', () => {
    const first = step('Первый', [{ label: 'А', points: 100 }])
    const branchy = q(300, { tree: tree([first]), special: { forAll: true, correct: 2 } })
    const { s, a } = setup(branchy)
    expect(s.answeringTeamId).toBe(a)
    expect(specialParts(branchy)).toEqual([])
  })
  it('подписи и починка', () => {
    expect(specialTitle(q(100, { special: { forAll: true, correct: 2 } }))).toBe('Вопрос для всех команд · ×2')
    expect(specialTitle(q(100, { special: { wrong: 0 } }))).toBe('Особый вопрос · без минуса')
    expect(specialTitle(q(100))).toBeNull()
    expect(cleanSpecial({ correct: 1, wrong: 1, forAll: false })).toBeUndefined()
    expect(cleanSpecial({ correct: 7 })).toBeUndefined()
    const repaired = repairGame(game([round([cat('А', [q(100, { special: { correct: 2, wrong: 0, forAll: true } }), q(200, { special: 'мусор' as never })])])]))!
    const [x, y] = repaired.rounds[0].categories[0].questions
    expect(x.special).toEqual({ correct: 2, wrong: 0, forAll: true })
    expect(y.special).toBeUndefined()
  })
})
