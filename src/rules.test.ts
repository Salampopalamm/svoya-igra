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
