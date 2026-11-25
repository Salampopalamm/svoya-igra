import { describe, expect, it } from 'vitest'
import {
  addTeam,
  distributeRandomly,
  gameProblems,
  isEmptyQuestion,
  mergeProgress,
  moveCategory,
  namesFromText,
  nextTeamId,
  rehearsalCells,
  removeTeam,
  resizeCategory,
  sortByValue,
  updateQuestion,
} from './game'
import { cat, emptyQ, game, q, round, step, team, tree } from './testing'
import type { Player } from './types'

describe('ход по кругу (nextTeamId)', () => {
  const g = game([round([])])
  const [a, b, c] = g.teams

  it('ход переходит к следующей команде', () => {
    expect(nextTeamId(g, a.id)).toBe(b.id)
    expect(nextTeamId(g, b.id)).toBe(c.id)
  })
  it('после последней — снова первая', () => {
    expect(nextTeamId(g, c.id)).toBe(a.id)
  })
  it('команды нет (удалили) — ход у первой', () => {
    expect(nextTeamId(g, 'нет-такой')).toBe(a.id)
    expect(nextTeamId(g, null)).toBe(a.id)
  })
  it('команд нет совсем — ход ничей', () => {
    expect(nextTeamId(game([round([])], []), null)).toBeNull()
  })
})

describe('склейка партии и свежей игры (mergeProgress)', () => {
  it('счёт и сыгранные ячейки — из партии, тексты вопросов — из свежей игры', () => {
    const stored = game([round([cat('География', [q(100), q(200)])])])
    const [first, second] = stored.rounds[0].categories[0].questions
    // Партия: сыграли первый вопрос, у команды А 100
    const progress = {
      ...updateQuestion(stored, first.id, (x) => ({ ...x, played: true })),
      teams: stored.teams.map((t, i) => ({ ...t, score: i === 0 ? 100 : 0 })),
    }
    // Тем временем в редакторе поправили текст второго вопроса
    const edited = updateQuestion(stored, second.id, (x) => ({ ...x, slides: [{ text: 'Новый текст' }] }))

    const merged = mergeProgress(edited, progress)
    const [m1, m2] = merged.rounds[0].categories[0].questions
    expect(m1.played).toBe(true)
    expect(m2.played).toBe(false)
    expect(m2.slides[0].text).toBe('Новый текст')
    expect(merged.teams.map((t) => t.score)).toEqual([100, 0, 0])
  })

  it('новая команда (добавили после начала партии) начинает со своего счёта', () => {
    const stored = game([round([])])
    const withNew = addTeam(stored)
    const merged = mergeProgress(withNew, { ...stored, teams: stored.teams.map((t) => ({ ...t, score: 300 })) })
    expect(merged.teams.map((t) => t.score)).toEqual([300, 300, 300, 0])
  })
})

describe('пустой вопрос (isEmptyQuestion)', () => {
  it('пробелы — это пусто', () => {
    expect(isEmptyQuestion(emptyQ(100, { slides: [{ text: '   ' }] }))).toBe(true)
  })
  it('вопрос с одним только ответом — не пустой', () => {
    expect(isEmptyQuestion(emptyQ(100, { answer: { text: 'Париж' } }))).toBe(false)
  })
  it('ветвящийся вопрос с текстом шага — не пустой', () => {
    expect(isEmptyQuestion(emptyQ(100, { tree: tree([step('Куда пойдёте?')]) }))).toBe(false)
  })
})

describe('проверка игры (gameProblems)', () => {
  const texts = (g: ReturnType<typeof game>) => gameProblems(g).map((p) => p.text)

  it('заполненная игра — без недочётов', () => {
    expect(texts(game([round([cat('А', [q(100), q(200)])])]))).toEqual([])
  })
  it('одинаковая стоимость — не недочёт', () => {
    expect(texts(game([round([cat('А', [q(400), q(400), q(400)])])]))).toEqual([])
  })
  it('вопрос без ответа и ответ без вопроса', () => {
    const g = game([round([cat('А', [q(100, { answer: {} }), q(200, { slides: [{}] })])])])
    expect(texts(g)).toEqual(['вопрос за 100 без ответа', 'за 200 есть ответ, но нет вопроса'])
  })
  it('пустые ячейки перечисляются одной строкой', () => {
    const g = game([round([cat('А', [q(100), emptyQ(200), emptyQ(300)])])])
    expect(texts(g)).toEqual(['пустые ячейки за 200, 300 — заполните или удалите'])
  })
  it('пустая категория и раунд без категорий', () => {
    const g = game([round([cat('А', [emptyQ(100)])]), round([])])
    expect(texts(g)).toEqual(['в категории нет ни одного заполненного вопроса', 'в раунде нет ни одной категории'])
  })
})

describe('сетка категории (resizeCategory)', () => {
  it('5 → 8: добавляются пустые 600, 700, 800', () => {
    const c = cat('А', [100, 200, 300, 400, 500].map((v) => q(v)))
    const { category, removed } = resizeCategory(c, 8)
    expect(category.questions.map((x) => x.value)).toEqual([100, 200, 300, 400, 500, 600, 700, 800])
    expect(removed).toEqual([])
  })
  it('уменьшение: сначала убираются пустые, потом самые дорогие заполненные', () => {
    const c = cat('А', [q(100), emptyQ(200), q(300), q(400)])
    const { category, removed } = resizeCategory(c, 2)
    expect(category.questions.map((x) => x.value)).toEqual([100, 300])
    expect(removed.map((x) => x.value)).toEqual([200, 400])
  })
})

describe('команды', () => {
  it('новая команда — по своему месту в списке, занятое имя пропускается', () => {
    expect(addTeam(game([round([])], [team('Команда 1'), team('Свои')])).teams.at(-1)!.name).toBe('Команда 3')
    const g = game([round([])], [team('Команда 1'), team('Команда 3')])
    expect(addTeam(g).teams.at(-1)!.name).toBe('Команда 4')
  })
  it('больше 10 команд не бывает', () => {
    const ten = game([round([])], Array.from({ length: 10 }, (_, i) => team(`К${i}`)))
    expect(addTeam(ten).teams).toHaveLength(10)
  })
  it('удалили команду — её игроки остаются без команды; последнюю удалить нельзя', () => {
    const g = game([round([])], [team('А'), team('Б')])
    const withPlayer = { ...g, players: [{ id: 'p', name: 'Аня', teamId: g.teams[0].id }] }
    const after = removeTeam(withPlayer, g.teams[0].id)
    expect(after.teams).toHaveLength(1)
    expect(after.players[0].teamId).toBeUndefined()
    expect(removeTeam(after, after.teams[0].id).teams).toHaveLength(1)
  })
  it('имена из Excel — первый столбец, пустые строки пропускаются', () => {
    expect(namesFromText('Аня\tОтдел продаж\r\n\r\n  Борис  \nВера')).toEqual(['Аня', 'Борис', 'Вера'])
  })
})

describe('случайное распределение (distributeRandomly)', () => {
  const players = (n: number, extra: Partial<Player> = {}): Player[] =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Игрок ${i}`, ...extra }))
  const sizes = (g: ReturnType<typeof game>) => g.teams.map((t) => g.players.filter((p) => p.teamId === t.id).length)
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646 // всегда одинаковая «случайность»

  it('поровну по командам', () => {
    const g = { ...game([round([])]), players: players(9) }
    expect(sizes(distributeRandomly(g, random))).toEqual([3, 3, 3])
  })
  it('капитаны остаются в своих командах', () => {
    const base = game([round([])])
    const captain: Player = { id: 'cap', name: 'Капитан', teamId: base.teams[2].id, locked: true }
    const result = distributeRandomly({ ...base, players: [captain, ...players(5)] }, random)
    expect(result.players.find((p) => p.id === 'cap')!.teamId).toBe(base.teams[2].id)
    expect(sizes(result)).toEqual([2, 2, 2])
  })
  it('команда с заданным размером заполняется до него, остальные — поровну', () => {
    const g = game([round([])], [team('А', 0, { targetSize: 5 }), team('Б'), team('В')])
    expect(sizes(distributeRandomly({ ...g, players: players(9) }, random))).toEqual([5, 2, 2])
  })
})

describe('порядок табло и репетиция', () => {
  it('ячейки по возрастанию цены, равные — как в игре', () => {
    const [a, b] = [q(400), q(400)]
    expect(sortByValue([q(500), a, q(100), b]).map((x) => x.value)).toEqual([100, 400, 400, 500])
    expect(sortByValue([a, b])).toEqual([a, b])
  })
  it('репетиция идёт по заполненным вопросам, финал пропускает', () => {
    const r1 = round([cat('А', [q(200), emptyQ(100), q(100)])])
    const fin = round([cat('Финал', [q(100)])], { kind: 'final' })
    const cells = rehearsalCells(game([r1, fin]))
    expect(cells).toHaveLength(2)
    expect(cells.every((c) => c.roundId === r1.id)).toBe(true)
  })
  it('категорию нельзя сдвинуть за край', () => {
    const r = round([cat('А', []), cat('Б', [])])
    const g = game([r])
    expect(moveCategory(g, r.categories[0].id, -1)).toEqual(g)
    expect(moveCategory(g, r.categories[0].id, 1).rounds[0].categories.map((c) => c.title)).toEqual(['Б', 'А'])
  })
})
