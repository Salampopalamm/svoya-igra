import { describe, expect, it } from 'vitest'
import { balanceNotes, cleanPlayRules, laggingTeamId, scaleRound } from './balance'
import { addRound, newCategory, newRoundStep, resizeCategory, roundStep } from './game'
import type { LiveState } from './live'
import { answerCorrect, answerPoints, answerWrong, closeQuestion, freshState, openCell, selectAnswering, switchRound } from './play'
import { repairGame } from './repairGame'
import { cat, game, q, round, team } from './testing'
import type { Game, PlayRules, Question } from './types'

const scores = (s: LiveState) => s.game.teams.map((t) => t.score)

// Партия с двумя раундами: в первом три вопроса, во втором — один; команды со счётом
function twoRounds(teamScores: number[], playRules?: PlayRules) {
  const first = cat('Кино', [q(100), q(200), q(300)])
  const second = cat('Музыка', [q(200)])
  const teams = teamScores.map((score, i) => team(`Команда ${i + 1}`, score))
  const g = game([round([first]), round([second])], teams, playRules ? { playRules } : {})
  const s = freshState(g)
  return { s, g, first, second, ids: teams.map((t) => t.id) }
}

describe('новый раунд начинает отстающая команда', () => {
  it('по умолчанию — команда с самым маленьким счётом', () => {
    const { s, g, ids } = twoRounds([500, -200, 300])
    const next = switchRound(s, g.rounds[1].id)
    expect(next.turnTeamId).toBe(ids[1])
  })

  it('при равном счёте — первая по кругу от команды, чей ход', () => {
    const { s, g, ids } = twoRounds([0, 100, 0])
    const turnAt3 = { ...s, turnTeamId: ids[2] }
    expect(laggingTeamId(g, ids[2])).toBe(ids[2])
    expect(switchRound(turnAt3, g.rounds[1].id).turnTeamId).toBe(ids[2])
    expect(laggingTeamId(g, ids[1])).toBe(ids[2]) // от второй по кругу: третья (0) раньше первой (0)
  })

  it('в уже начатый раунд ход не меняется; автор может выключить правило', () => {
    const { s, g } = twoRounds([500, -200, 300])
    const played = { ...s, game: { ...g, rounds: [g.rounds[0], { ...g.rounds[1], categories: [{ ...g.rounds[1].categories[0], questions: [{ ...g.rounds[1].categories[0].questions[0], played: true }] }] }] } }
    expect(switchRound(played, g.rounds[1].id).turnTeamId).toBe(s.turnTeamId)
    const off = twoRounds([500, -200, 300], { roundStart: 'continue' })
    expect(switchRound(off.s, off.g.rounds[1].id).turnTeamId).toBe(off.s.turnTeamId)
  })
})

describe('заглянули в следующий раунд и вернулись', () => {
  it('ничего там не сыграв — ход как был; назад в раунд ход отстающей не отдаётся', () => {
    const { s, g, ids } = twoRounds([500, -200, 300])
    const midGame = { ...s, turnTeamId: ids[2] } // в первом раунде ход у третьей команды
    const peek = switchRound(midGame, g.rounds[1].id)
    expect(peek.turnTeamId).toBe(ids[1]) // новый раунд начинает отстающая
    const back = switchRound(peek, g.rounds[0].id)
    expect(back.turnTeamId).toBe(ids[2]) // вернулись — ход снова у третьей
    expect(back.turnBeforeRound).toBeNull()
  })

  it('во втором раунде уже играли — возврат ход не трогает', () => {
    const { s, g, ids } = twoRounds([500, -200, 300])
    const peek = switchRound({ ...s, turnTeamId: ids[2] }, g.rounds[1].id)
    const played = { ...peek, turnTeamId: ids[0], game: { ...peek.game, rounds: [peek.game.rounds[0], { ...peek.game.rounds[1], categories: [{ ...peek.game.rounds[1].categories[0], questions: [{ ...peek.game.rounds[1].categories[0].questions[0], played: true }] }] }] } }
    expect(switchRound(played, g.rounds[0].id).turnTeamId).toBe(ids[0])
  })
})

describe('перехват за половину', () => {
  function stealGame(playRules?: PlayRules, question: Question = q(300)) {
    const category = cat('Кино', [question])
    const g = game([round([category])], [team('Совы'), team('Лисы'), team('Ежи')], playRules ? { playRules } : {})
    const s = openCell(freshState(g), { categoryId: category.id, questionId: question.id })
    const [a, b, c] = g.teams.map((t) => t.id)
    return { s, a, b, c }
  }

  it('первая команда отвечает за полную стоимость, перехват — за половину (и плюс, и минус)', () => {
    const { s, a, b, c } = stealGame({ steal: 'half' })
    expect(answerPoints(s, a)).toEqual({ plus: 300, minus: 300 })
    let st = answerWrong(s, a)
    expect(answerPoints(st, b)).toEqual({ plus: 150, minus: 150 })
    st = answerWrong(selectAnswering(st, b), b)
    st = answerCorrect(selectAnswering(st, c), c)
    expect(scores(st)).toEqual([-300, -150, 150])
    expect(st.log?.at(-1)).toMatchObject({ points: 150, note: 'перехват за половину' })
  })

  it('по умолчанию перехват — за полную стоимость', () => {
    const { s, a, b } = stealGame()
    const st = answerCorrect(selectAnswering(answerWrong(s, a), b), b)
    expect(scores(st)).toEqual([-300, 300, 0])
  })

  it('×2 и половина: перехват особого вопроса — половина удвоенной стоимости', () => {
    const { s, a, b } = stealGame({ steal: 'half' }, q(300, { special: { correct: 2 } }))
    expect(answerPoints(answerWrong(s, a), b).plus).toBe(300)
  })

  it('никто не перехватил — вопрос закрывается как обычно', () => {
    const { s, a } = stealGame({ steal: 'half' })
    expect(closeQuestion(answerWrong(s, a)).current).toBeNull()
  })
})

describe('цены растут от раунда к раунду', () => {
  it('новый раунд вдвое, втрое дороже первого', () => {
    let g: Game = game([round([newCategory(5)])])
    expect(newRoundStep(g)).toBe(200)
    g = addRound(g).game
    expect(g.rounds[1].categories[0].questions.map((x) => x.value).slice(0, 3)).toEqual([200, 400, 600])
    g = addRound(g).game
    expect(roundStep(g.rounds[2])).toBe(300)
  })

  it('недостающие вопросы сетки — с шагом раунда', () => {
    const { category } = resizeCategory(cat('Кино', [q(200), q(400)]), 4, 200)
    expect(category.questions.map((x) => x.value)).toEqual([200, 400, 600, 800])
  })

  it('«Цены ×2» меняют и цену кота, и цену подсказки', () => {
    const r = scaleRound(round([cat('Кино', [q(100, { kind: 'cat-in-bag', cat: { value: 250 }, hintCost: 50 })])]), 2)
    expect(r.categories[0].questions[0]).toMatchObject({ value: 200, cat: { value: 500 }, hintCost: 100 })
    expect(scaleRound(r, 0.5).categories[0].questions[0].value).toBe(100)
  })
})

describe('проверка баланса', () => {
  it('ходов не поровну: 3 вопроса на 2 команды', () => {
    const g = game([round([cat('Кино', [q(100), q(200), q(300)])])], [team('А'), team('Б')])
    expect(balanceNotes(g).map((n) => n.text)).toEqual([
      'в игре 3 вопроса на 2 команды: одна команда сходит 2 раза, остальные — 1 раз. Чтобы ходов было поровну, добавьте 1 вопрос или уберите 1 вопрос',
    ])
  })

  it('без отстающей в начале раунда считаем всю игру, а не каждый раунд', () => {
    const r1 = round([cat('Кино', [q(100), q(200), q(300)])])
    const r2 = round([cat('Музыка', [q(400)])])
    const g = game([r1, r2], [team('А'), team('Б')], { playRules: { roundStart: 'continue' } })
    expect(balanceNotes(g)).toEqual([]) // 4 вопроса на 2 команды, второй раунд дороже
    expect(balanceNotes({ ...g, playRules: undefined }).filter((n) => n.roundId).length).toBe(2)
  })

  it('больше одного особого вопроса в категории и цены, которые не растут', () => {
    const r1 = round([cat('Кино', [q(100, { special: { correct: 2 } }), q(200, { kind: 'auction' })])])
    const r2 = round([cat('Музыка', [q(100), q(200)])])
    const notes = balanceNotes(game([r1, r2], [team('А'), team('Б')]))
    expect(notes.map((n) => n.text)).toEqual([
      '2 особых вопроса в одной категории (×2, кот, аукцион…) — лучше не больше одного: меньше случайности',
      `цены не выше, чем в «${r1.title}» — отставшим трудно догнать. Обычно каждый следующий раунд дороже`,
    ])
    expect(notes[1]).toMatchObject({ roundId: r2.id, scaleUp: true })
  })

  it('скрытые и пустые вопросы ходов не дают; финал не считается', () => {
    const g = game(
      [round([cat('Кино', [q(100), q(200), q(300, { hidden: true }), q(400, { slides: [{}], answer: {} })])]), round([cat('Тема', [q(0)])], { kind: 'final' })],
      [team('А'), team('Б')],
    )
    expect(balanceNotes(g)).toEqual([])
  })
})

it('починка игры: правила партии — только известные значения', () => {
  expect(cleanPlayRules({ roundStart: 'continue', steal: 'half' })).toEqual({ roundStart: 'continue', steal: 'half' })
  expect(cleanPlayRules({ roundStart: 'last', steal: 'чуть-чуть' })).toBeUndefined()
  const g = repairGame(JSON.parse(JSON.stringify(game([round([])], [team('А')], { playRules: { steal: 'half' } }))))
  expect(g?.playRules).toEqual({ steal: 'half' })
})
