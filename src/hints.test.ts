import { describe, expect, it } from 'vitest'
import { hintPenalty, hintsOf } from './hints'
import type { LiveState } from './live'
import { answerCorrect, answerPoints, answerWrong, freshState, hideHint, markAll, openCell, revealAll, selectAnswering, showAnswer, showHint, withClosed } from './play'
import { repairGame } from './repairGame'
import { mediaIdsOf } from './game'
import { cat, game, picture, q, round, team } from './testing'
import type { Question } from './types'

function setup(question: Question) {
  const category = cat('Кино', [question])
  const s = freshState(game([round([category])], [team('Совы'), team('Лисы')]))
  const cell = { categoryId: category.id, questionId: question.id }
  const [a, b] = s.game.teams.map((t) => t.id)
  return { s: openCell(s, cell), a, b }
}
const scores = (s: LiveState) => s.game.teams.map((t) => t.score)
const hints = [{ text: 'Это фильм 1975 года' }, { text: 'Режиссёр — Рязанов' }, { media: picture('кадр.jpg') }]

describe('подсказки', () => {
  it('пустые подсказки не показываются; у ветвящегося вопроса подсказок нет', () => {
    expect(hintsOf(q(100, { hints: [{}, { text: ' ' }, { text: 'есть' }] }))).toEqual([{ text: 'есть' }])
    expect(hintsOf(q(100, { hints, tree: { startNodeId: 'n', branchBy: 'choice', scoring: 'per-step', nodes: [] } }))).toEqual([])
  })

  it('показывают по порядку: пропустить нельзя, показанную можно вывести снова', () => {
    const { s } = setup(q(400, { hints }))
    expect(showHint(s, 1)).toBe(s)
    const first = showHint(s, 0)
    expect(first.hint).toEqual({ shown: 1, open: 0 })
    const second = showHint(first, 1)
    expect(second.hint).toEqual({ shown: 2, open: 1 })
    expect(showHint(second, 0).hint).toEqual({ shown: 2, open: 0 }) // снова первая — не считается новой
    expect(hideHint(second).hint).toEqual({ shown: 2, open: null })
    expect(showHint(second, 3)).toBe(second) // такой подсказки нет
  })

  it('бесплатные подсказки счёт не меняют', () => {
    const { s, a } = setup(q(400, { hints }))
    const done = answerCorrect(showHint(showHint(s, 0), 1), a)
    expect(scores(done)).toEqual([400, 0])
  })

  it('платные: за верный ответ меньше на цену каждой показанной подсказки, не ниже нуля; минус — как был', () => {
    const { s, a, b } = setup(q(400, { hints, hintCost: 150 }))
    const one = showHint(s, 0)
    expect(answerPoints(one, a)).toEqual({ plus: 250, minus: 400 })
    const all = showHint(showHint(one, 1), 2)
    expect(hintPenalty(all.game.rounds[0].categories[0].questions[0], 3)).toBe(450)
    expect(answerPoints(all, a)).toEqual({ plus: 0, minus: 400 })
    const wrong = answerWrong(one, a)
    expect(scores(wrong)).toEqual([-400, 0])
    const stolen = answerCorrect(selectAnswering(wrong, b), b)
    expect(scores(stolen)).toEqual([-400, 250])
    expect(stolen.log?.at(-1)).toMatchObject({ points: 250, note: 'подсказок: 1, −150 за верный' })
  })

  it('вопрос «для всех команд» — подсказка дешевит верный ответ всем', () => {
    const { s, a, b } = setup(q(400, { hints, hintCost: 100, special: { forAll: true } }))
    const done = revealAll(markAll(markAll(showHint(s, 0), a, true), b, false))
    expect(scores(done)).toEqual([300, -400])
  })

  it('ответ в зале убирает подсказку; закрытый вопрос забывает подсказки', () => {
    const { s } = setup(q(400, { hints }))
    const shown = showHint(s, 0)
    expect(showAnswer(shown).hint).toEqual({ shown: 1, open: null })
    expect(withClosed(shown).hint).toBeNull()
  })

  it('картинки подсказок — файлы вопроса (их сохраняют в файл игры и удаляют вместе с вопросом)', () => {
    const question = q(100, { hints })
    expect(mediaIdsOf(question)).toContain(hints[2].media!.id)
  })

  it('починка игры: не больше трёх подсказок, цена — целое число больше нуля', () => {
    const broken = game([round([cat('Кино', [q(100, { hints: [...hints, { text: 'четвёртая' }], hintCost: -5 })])])])
    const fixed = repairGame(JSON.parse(JSON.stringify(broken)))!.rounds[0].categories[0].questions[0]
    expect(fixed.hints).toHaveLength(3)
    expect(fixed.hintCost).toBeUndefined()
  })
})
