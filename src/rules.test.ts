import { describe, expect, it } from 'vitest'
import { describeRule, readyRules, ruleConditionMet, ruleProblem } from './rules'
import { cat, emptyQ, game, picture, q, round, team } from './testing'
import type { Rule } from './types'

const rule = (when: Rule['when'], then: Rule['then']): Rule => ({ id: `rule-${Math.random()}`, when, then })

// Игра: обычный раунд (100, 200 и скрытый 300) и скрытый бонусный раунд
function setup() {
  const hidden = q(300, { hidden: true })
  const main = round([cat('География', [q(100), q(200), hidden, emptyQ(400)])], { title: 'Основной' })
  const bonus = round([cat('Бонус', [q(500)])], { title: 'Бонус', hidden: true })
  const g = game([main, bonus], [team('Совы', 0), team('Лисы', 0)])
  return { g, main, bonus, hidden }
}
const played = (g: ReturnType<typeof game>, ids: string[]) => ({
  ...g,
  rounds: g.rounds.map((r) => ({
    ...r,
    categories: r.categories.map((c) => ({ ...c, questions: c.questions.map((x) => (ids.includes(x.id) ? { ...x, played: true } : x)) })),
  })),
})

describe('недочёты правила (ruleProblem)', () => {
  const { g, hidden, bonus } = setup()
  it('правильное правило — без недочётов', () => {
    expect(ruleProblem(g, rule({ kind: 'score-reached', value: 1000 }, { kind: 'unlock-question', target: hidden.id }))).toBeNull()
    expect(ruleProblem(g, rule({ kind: 'score-reached', value: 1000 }, { kind: 'open-round', target: bonus.id }))).toBeNull()
  })
  it('не указаны баллы, раунд, вопрос, цель или картинка', () => {
    const open = { kind: 'unlock-question' as const, target: hidden.id }
    expect(ruleProblem(g, rule({ kind: 'score-reached', value: 0 }, open))).toBe('укажите, сколько баллов')
    expect(ruleProblem(g, rule({ kind: 'round-finished', value: 'нет' }, open))).toBe('выберите раунд')
    expect(ruleProblem(g, rule({ kind: 'question-played', value: 'нет' }, open))).toBe('выберите вопрос')
    const when = { kind: 'score-reached' as const, value: 100 }
    expect(ruleProblem(g, rule(when, { kind: 'unlock-question', target: g.rounds[0].categories[0].questions[0].id }))).toMatch(/скрытый вопрос/)
    expect(ruleProblem(g, rule(when, { kind: 'show-media', target: '' }))).toBe('загрузите картинку или видео')
    expect(ruleProblem(g, rule(when, { kind: 'show-media', target: '', media: picture() }))).toBeNull()
  })
})

describe('когда правило срабатывает', () => {
  it('команда набрала нужный счёт', () => {
    const { g, hidden } = setup()
    const r = rule({ kind: 'score-reached', value: 500 }, { kind: 'unlock-question', target: hidden.id })
    expect(ruleConditionMet(g, r, [])).toBe(false)
    const scored = { ...g, teams: g.teams.map((t, i) => ({ ...t, score: i === 1 ? 500 : 0 })) }
    expect(ruleConditionMet(scored, r, [])).toBe(true)
    expect(describeRule(scored, r).when).toBe('«Лисы» набрала 500')
  })
  it('раунд сыгран: закрытый скрытый вопрос и пустые ячейки не мешают, открытый скрытый — мешает', () => {
    const { g, main, bonus, hidden } = setup()
    const r = rule({ kind: 'round-finished', value: main.id }, { kind: 'open-round', target: bonus.id })
    const [q100, q200] = main.categories[0].questions
    const both = played(g, [q100.id, q200.id])
    expect(ruleConditionMet(played(g, [q100.id]), r, [])).toBe(false)
    expect(ruleConditionMet(both, r, [])).toBe(true)
    expect(ruleConditionMet(both, r, [hidden.id])).toBe(false)
  })
  it('выполненное или пропущенное правило больше не предлагается', () => {
    const { g, hidden } = setup()
    const r = rule({ kind: 'question-played', value: g.rounds[0].categories[0].questions[0].id }, { kind: 'unlock-question', target: hidden.id })
    const withRule = { ...played(g, [g.rounds[0].categories[0].questions[0].id]), rules: [r] }
    expect(readyRules(withRule, [], [])).toEqual([r])
    expect(readyRules(withRule, [r.id], [])).toEqual([])
  })
})

describe('новые условия и действия (25.11)', () => {
  // Три команды: Совы 600, Лисы 100, Ежи 0
  function teams3() {
    const category = cat('География', [q(100), q(200)])
    const g = game([round([category])], [team('Совы', 600), team('Лисы', 100), team('Ежи', 0)])
    const [a, b, c] = g.teams.map((t) => t.id)
    return { g, category, a, b, c }
  }
  const wrong = (teamId: string) => ({ at: 0, kind: 'wrong' as const, teamId, points: -100 })

  it('«ошиблась подряд»: считает по журналу, верный ответ обнуляет', () => {
    const { g, b } = teams3()
    const r = rule({ kind: 'wrong-streak', value: 2 }, { kind: 'add-points', target: 'trigger', points: 100 })
    expect(ruleConditionMet(g, r, [], [wrong(b)])).toBe(false)
    expect(ruleConditionMet(g, r, [], [wrong(b), wrong(b)])).toBe(true)
    expect(ruleConditionMet(g, r, [], [wrong(b), wrong(b), { at: 0, kind: 'correct', teamId: b, points: 100 }])).toBe(false)
    expect(describeRule(g, r, [wrong(b), wrong(b)])).toEqual({ when: '«Лисы» ошиблась 2 раза подряд', then: 'дать 100 «Лисы»' })
  })
  it('«отстаёт от лидера»: самая отстающая — первой', () => {
    const { g } = teams3()
    const r = rule({ kind: 'behind', value: 500 }, { kind: 'give-turn', target: 'trigger' })
    expect(ruleConditionMet(g, r, [])).toBe(true)
    expect(describeRule(g, r).then).toBe('передать ход «Ежи»')
    expect(ruleConditionMet(g, rule({ kind: 'behind', value: 700 }, r.then), [])).toBe(false)
  })
  it('«сыграна категория»', () => {
    const { g, category } = teams3()
    const r = rule({ kind: 'category-played', value: category.id }, { kind: 'show-text', target: '', text: 'Бонус!' })
    expect(ruleConditionMet(g, r, [])).toBe(false)
    expect(ruleConditionMet(played(g, category.questions.map((x) => x.id)), r, [])).toBe(true)
  })
  it('недочёты новых правил', () => {
    const { g, category } = teams3()
    const byRound = { kind: 'category-played' as const, value: category.id }
    expect(ruleProblem(g, rule(byRound, { kind: 'add-points', target: 'trigger', points: 100 }))).toMatch(/нет своей команды/)
    expect(ruleProblem(g, rule(byRound, { kind: 'add-points', target: 'last', points: 100 }))).toBeNull()
    expect(ruleProblem(g, rule(byRound, { kind: 'add-points', target: 'last' }))).toBe('укажите, сколько баллов дать')
    expect(ruleProblem(g, rule(byRound, { kind: 'show-text', target: '', text: '  ' }))).toBe('впишите надпись')
    expect(ruleProblem(g, rule({ kind: 'wrong-streak', value: 0 }, { kind: 'give-turn', target: 'leader' }))).toBe('укажите, сколько ошибок подряд')
    expect(ruleProblem(g, rule({ kind: 'category-played', value: 'нет' }, { kind: 'give-turn', target: 'leader' }))).toBe('выберите категорию')
  })
  it('выполнить: баллы (в журнал), ход, надпись в зале', async () => {
    const { runRule, freshState } = await import('./play')
    const { g, b, c } = teams3()
    const s = { ...freshState(g), log: [wrong(b), wrong(b)] }
    const bonus = runRule(s, rule({ kind: 'wrong-streak', value: 2 }, { kind: 'add-points', target: 'trigger', points: 150 }))
    expect(bonus.game.teams.map((t) => t.score)).toEqual([600, 250, 0])
    expect(bonus.log?.at(-1)).toMatchObject({ kind: 'rule', teamId: b, points: 150, note: 'правило: «Лисы» ошиблась 2 раза подряд' })
    const fine = runRule(s, rule({ kind: 'score-reached', value: 500 }, { kind: 'add-points', target: 'leader', points: -100 }))
    expect(fine.game.teams[0].score).toBe(500)
    expect(runRule(s, rule({ kind: 'behind', value: 300 }, { kind: 'give-turn', target: 'trigger' })).turnTeamId).toBe(c)
    const text = runRule(s, rule({ kind: 'behind', value: 300 }, { kind: 'show-text', target: '', text: 'Догоняйте!' }))
    expect(text.shownText).toBe('Догоняйте!')
    expect(text.rulesDone).toHaveLength(1)
  })
})
