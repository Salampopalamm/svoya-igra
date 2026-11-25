import { describe, expect, it } from 'vitest'
import { repairGame } from './repairGame'
import { cat, emptyQ, game, picture, q, round, step, team, tree } from './testing'

// Объект без полей, где лежит undefined: так сравниваем «то же самое по сути»
const plain = (v: unknown) => JSON.parse(JSON.stringify(v))

describe('починка игры (repairGame)', () => {
  it('исправная игра после починки та же самая — ничего не теряется', () => {
    const photo = picture('фото.jpg')
    const g = game(
      [
        round([
          cat('Кино', [
            q(100, { hostNote: 'подсказка', timerSec: 30, hidden: true }),
            q(200, { slides: [{ text: 'т', media: photo, more: [picture()], layout: 'cols-2', place: { text: { x: 0, y: 0, w: 100, h: 20 } } }] }),
            emptyQ(300, { tree: tree([step('Шаг', [{ label: 'А', points: 100, unlockQuestionId: 'q-x' }])], { branchBy: 'correctness', scoring: 'at-end' }) }),
          ]),
        ]),
        round([cat('Финал', [q(100)])], { kind: 'final', hidden: true }),
      ],
      [team('А', 0, { emoji: '🦊', targetSize: 3 }), team('Б', 0, { logo: picture('лого.png') })],
      {
        date: '2026-12-31',
        players: [{ id: 'p1', name: 'Аня', photo, locked: true }],
        rules: [{ id: 'r1', when: { kind: 'score-reached', value: 500 }, then: { kind: 'show-media', target: '', media: photo } }],
        updatedAt: 123,
      },
    )
    g.theme = { ...g.theme, accentColor: '#E53935', logo: photo, pinnedTimerSec: 45, sizes: { board: 120, teams: 100, photos: 100, media: 100, text: 90, timer: 100 }, itemSizes: { 'cell:q1': 150 } }
    expect(plain(repairGame(g))).toEqual(plain(g))
  })

  it('не игра вообще — null', () => {
    expect(repairGame(null)).toBeNull()
    expect(repairGame('текст')).toBeNull()
    expect(repairGame([1, 2])).toBeNull()
  })

  it('испорченные поля заполняются, мусор выбрасывается', () => {
    const repaired = repairGame({
      title: '',
      rounds: [{ categories: [{ title: 'А', questions: [{ value: '300', slides: null, answer: 5 }, 'мусор'] }] }, null],
      teams: [{ name: 'Совы', score: 'много' }, 7],
      players: [{ name: 'Аня', teamId: 'нет-такой' }],
      theme: { backgroundTone: 'розовый', sizes: 3 },
      rules: [{ when: 1 }],
    })!
    const question = repaired.rounds[0].categories[0].questions[0]
    expect(repaired.title).toBe('Игра из файла')
    expect(repaired.rounds).toHaveLength(1)
    expect(repaired.rounds[0].categories[0].questions).toHaveLength(1)
    expect(question).toMatchObject({ value: 300, slides: [{}], answer: {}, played: false, kind: 'normal' })
    expect(repaired.teams).toMatchObject([{ name: 'Совы', score: 0 }])
    expect(repaired.players[0].teamId).toBeUndefined()
    expect(repaired.theme.backgroundTone).toBe('graphite')
    expect(repaired.theme.sizes).toBeUndefined()
    expect(repaired.rules).toEqual([])
  })

  it('игра без раундов получает пустой первый раунд', () => {
    expect(repairGame({ title: 'Пусто' })!.rounds).toMatchObject([{ title: 'Раунд 1', kind: 'standard', categories: [] }])
  })

  it('вопрос старого вида (поле prompt) становится слайдом', () => {
    const repaired = repairGame({ rounds: [{ categories: [{ questions: [{ value: 100, prompt: { text: 'Старый' } }] }] }] })!
    expect(repaired.rounds[0].categories[0].questions[0].slides).toEqual([{ text: 'Старый' }])
  })

  it('испорченная рамка расстановки уходит, целые остаются', () => {
    const good = { x: 0, y: 0, w: 50, h: 50 }
    const repaired = repairGame({ rounds: [{ categories: [{ questions: [{ value: 100, slides: [{ text: 'т', place: { text: good, media: [{ x: 'a' }, good] } }] }] }] }] })!
    expect(repaired.rounds[0].categories[0].questions[0].slides[0].place).toEqual({ text: good, media: [undefined, good] })
  })
})
