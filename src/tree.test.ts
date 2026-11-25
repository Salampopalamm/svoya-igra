import { describe, expect, it } from 'vitest'
import { chooseOption, formatPoints, removeStep, setBranchBy, startBranch, treeProblems } from './tree'
import { step, tree } from './testing'

describe('прохождение ветки', () => {
  // Шаг 1 → (А: +100 → Шаг 2) / (Б: 0 → конец). Шаг 2 → (А: +50 → конец) / (Б: −50 → конец)
  const end = step('Конец')
  const second = step('Второй вопрос', [
    { label: 'А', points: 50, nextNodeId: end.id },
    { label: 'Б', points: -50 },
  ])
  const first = step('Первый вопрос', [
    { label: 'А', points: 100, nextNodeId: second.id },
    { label: 'Б', points: 0 },
  ])
  const t = tree([first, second, end])

  it('баллы копятся по шагам, ветка кончается на шаге без вариантов', () => {
    let b = startBranch(t)
    expect(b).toMatchObject({ nodeId: first.id, earned: 0, done: false })
    b = chooseOption(t, b, 0)
    expect(b).toMatchObject({ nodeId: second.id, earned: 100, done: false })
    b = chooseOption(t, b, 0)
    expect(b).toMatchObject({ nodeId: end.id, earned: 150, done: true })
    expect(b.path.map((p) => p.option)).toEqual([0, 0])
  })
  it('вариант без следующего шага — конец ветки, остаёмся на месте', () => {
    const b = chooseOption(t, chooseOption(t, startBranch(t), 0), 1)
    expect(b).toMatchObject({ nodeId: second.id, earned: 50, done: true })
  })
  it('после конца ветки выбор ничего не меняет', () => {
    const done = chooseOption(t, startBranch(t), 1)
    expect(chooseOption(t, done, 0)).toBe(done)
  })
  it('первый шаг без вариантов — ветка сразу закончена', () => {
    expect(startBranch(tree([step('Сцена')])).done).toBe(true)
  })
  it('баллы словами', () => {
    expect([formatPoints(100), formatPoints(-50), formatPoints(0)]).toEqual(['+100', '−50', '0'])
  })
})

describe('проверка дерева (treeProblems)', () => {
  it('правильное дерево — без недочётов', () => {
    const end = step('Конец')
    expect(treeProblems(tree([step('Вопрос', [{ label: 'Да', points: 1, nextNodeId: end.id }, { label: 'Нет', points: 0 }]), end]))).toEqual([])
  })
  it('цикл: ветка возвращается по кругу', () => {
    const a = step('А')
    const b = step('Б', [{ label: 'назад', points: 0, nextNodeId: a.id }, { label: 'стоп', points: 0 }])
    a.options = [{ label: 'дальше', points: 0, nextNodeId: b.id }, { label: 'стоп', points: 0 }]
    expect(treeProblems(tree([a, b])).map((p) => p.text)).toContain('Шаг 1: ветка возвращается сюда по кругу и не закончится')
  })
  it('недостижимый шаг, пустой шаг, вариант без подписи, один вариант', () => {
    const lonely = step('')
    const start = step('Старт', [{ label: '', points: 0 }])
    const texts = treeProblems(tree([start, lonely])).map((p) => p.text)
    expect(texts).toEqual([
      'Шаг 1: у варианта А нет подписи',
      'Шаг 1: всего один вариант — выбирать не из чего',
      'Шаг 2: нет текста или файла',
      'Шаг 2: ни один вариант не ведёт сюда',
    ])
  })
  it('у первого шага нет вариантов', () => {
    expect(treeProblems(tree([step('Старт')])).map((p) => p.text)).toEqual(['у первого шага нет вариантов — ветвиться нечему'])
  })
})

describe('правка дерева', () => {
  it('удалили шаг — варианты, что вели в него, ведут к концу; первый шаг удалить нельзя', () => {
    const second = step('Второй')
    const first = step('Первый', [{ label: 'А', points: 0, nextNodeId: second.id }])
    const t = tree([first, second])
    const after = removeStep(t, second.id)
    expect(after.nodes).toHaveLength(1)
    expect(after.nodes[0].options[0].nextNodeId).toBeUndefined()
    expect(removeStep(t, first.id)).toBe(t)
  })
  it('по правильности — у каждого шага ровно «Верно» и «Неверно», переходы сохраняются', () => {
    const next = step('Дальше')
    const first = step('Первый', [
      { label: 'А', points: 300, nextNodeId: next.id },
      { label: 'Б', points: 0 },
      { label: 'В', points: 0 },
    ])
    const t = setBranchBy(tree([first, next]), 'correctness', 500)
    expect(t.nodes[0].options).toEqual([
      { label: 'Верно', points: 300, nextNodeId: next.id },
      { label: 'Неверно', points: 0, nextNodeId: undefined },
    ])
    expect(t.nodes[1].options).toEqual([]) // конец ветки остаётся концом
  })
})
