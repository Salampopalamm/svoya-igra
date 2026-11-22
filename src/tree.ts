import type { Content, Question, QuestionTree, TreeNode } from './types'

// Ветвящийся вопрос: шаги (TreeNode) и варианты ответа на каждом шаге.
// Вариант даёт баллы и ведёт к следующему шагу или к концу ветки.
//   По выбору варианта (branchBy 'choice'): варианты А, Б, В… с подписями.
//   По правильности (branchBy 'correctness'): ровно два варианта — «Верно» и «Неверно».
// Баллы — за каждый шаг сразу (scoring 'per-step') или одной суммой в конце ветки ('at-end').
// Шаг без вариантов — конец ветки (например, итоговая сцена).

const newId = () => crypto.randomUUID()

export const LETTERS = 'АБВГДЕЖЗИК' // буквы вариантов, как в тестах
export const MAX_OPTIONS = LETTERS.length

export type TreeOption = TreeNode['options'][number]

export function newStep(content: Content = {}): TreeNode {
  return { id: newId(), kind: 'end', content, options: [] }
}

// Варианты «Верно / Неверно» для дерева по правильности
export function correctnessOptions(value: number, old: TreeOption[] = []): TreeOption[] {
  return [
    { label: 'Верно', points: old[0]?.points ?? value, nextNodeId: old[0]?.nextNodeId },
    { label: 'Неверно', points: old[1]?.points ?? 0, nextNodeId: old[1]?.nextNodeId },
  ]
}

// Шаг с вариантами — вопрос, без вариантов — конец ветки
export function withKind(node: TreeNode): TreeNode {
  return { ...node, kind: node.options.length > 0 ? 'question' : 'end' }
}

// Новое дерево: первый шаг — то, что уже было в вопросе (первый слайд и ответ), и два варианта
export function newTree(question: Question): QuestionTree {
  const start: TreeNode = withKind({
    ...newStep(question.slides[0] ?? {}),
    answer: question.answer.text || question.answer.media ? question.answer : undefined,
    options: [
      { label: '', points: question.value },
      { label: '', points: 0 },
    ],
  })
  return { startNodeId: start.id, branchBy: 'choice', scoring: 'per-step', nodes: [start] }
}

export function stepById(tree: QuestionTree, id: string | undefined): TreeNode | undefined {
  return id ? tree.nodes.find((n) => n.id === id) : undefined
}

// Номер шага для людей: «Шаг 1», «Шаг 2»… — по порядку в списке
export function stepNumber(tree: QuestionTree, id: string): number {
  return tree.nodes.findIndex((n) => n.id === id) + 1
}

// Изменить один шаг
export function updateStep(tree: QuestionTree, id: string, change: (n: TreeNode) => TreeNode): QuestionTree {
  return { ...tree, nodes: tree.nodes.map((n) => (n.id === id ? withKind(change(n)) : n)) }
}

// Удалить шаг (кроме первого). Варианты, которые вели в него, теперь ведут к концу ветки.
export function removeStep(tree: QuestionTree, id: string): QuestionTree {
  if (id === tree.startNodeId) return tree
  return {
    ...tree,
    nodes: tree.nodes
      .filter((n) => n.id !== id)
      .map((n) => ({ ...n, options: n.options.map((o) => (o.nextNodeId === id ? { ...o, nextNodeId: undefined } : o)) })),
  }
}

// Сменить тип ветвления. По правильности — у каждого шага с вариантами ровно «Верно» и «Неверно».
export function setBranchBy(tree: QuestionTree, branchBy: QuestionTree['branchBy'], value: number): QuestionTree {
  if (branchBy === 'choice') return { ...tree, branchBy }
  return {
    ...tree,
    branchBy,
    nodes: tree.nodes.map((n) => (n.options.length > 0 ? { ...n, options: correctnessOptions(value, n.options) } : n)),
  }
}

// Все тексты и файлы дерева — чтобы понять, заполнен ли вопрос, и не потерять файлы
export function treeContents(tree: QuestionTree | undefined): Content[] {
  return tree ? tree.nodes.flatMap((n) => (n.answer ? [n.content, n.answer] : [n.content])) : []
}

const hasContent = (c: Content) => Boolean(c.text?.trim() || c.media)

// ---- Проверка дерева ----

export type TreeProblem = { stepId?: string; text: string }

// Тупики, недостижимые шаги, циклы, пустые шаги и варианты без подписи
export function treeProblems(tree: QuestionTree): TreeProblem[] {
  const problems: TreeProblem[] = []
  const name = (id: string) => `Шаг ${stepNumber(tree, id)}`
  const start = stepById(tree, tree.startNodeId)
  if (!start) return [{ text: 'нет первого шага' }]

  // Какие шаги достижимы с первого
  const reachable = new Set<string>()
  const queue = [start.id]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const o of stepById(tree, id)?.options ?? []) if (o.nextNodeId && stepById(tree, o.nextNodeId)) queue.push(o.nextNodeId)
  }

  for (const node of tree.nodes) {
    if (!hasContent(node.content)) problems.push({ stepId: node.id, text: `${name(node.id)}: нет текста или файла` })
    if (!reachable.has(node.id)) problems.push({ stepId: node.id, text: `${name(node.id)}: ни один вариант не ведёт сюда` })
    if (tree.branchBy === 'choice') {
      node.options.forEach((o, i) => {
        if (!o.label.trim()) problems.push({ stepId: node.id, text: `${name(node.id)}: у варианта ${LETTERS[i]} нет подписи` })
      })
      if (node.options.length === 1) problems.push({ stepId: node.id, text: `${name(node.id)}: всего один вариант — выбирать не из чего` })
    }
  }
  if (start.options.length === 0) problems.push({ stepId: start.id, text: 'у первого шага нет вариантов — ветвиться нечему' })

  // Цикл: из шага можно снова прийти в него же — ветка никогда не закончится
  const state = new Map<string, 'visiting' | 'done'>()
  let cycleAt: string | null = null
  const visit = (id: string) => {
    if (cycleAt || state.get(id) === 'done') return
    if (state.get(id) === 'visiting') {
      cycleAt = id
      return
    }
    state.set(id, 'visiting')
    for (const o of stepById(tree, id)?.options ?? []) if (o.nextNodeId && stepById(tree, o.nextNodeId)) visit(o.nextNodeId)
    state.set(id, 'done')
  }
  visit(start.id)
  if (cycleAt) problems.push({ stepId: cycleAt, text: `${name(cycleAt)}: ветка возвращается сюда по кругу и не закончится` })

  return problems
}

// ---- Прохождение в игре ----

// Где сейчас ветка: шаг, выбранные варианты и набранные баллы
export type BranchState = {
  nodeId: string
  path: { nodeId: string; option: number }[]
  earned: number // сколько набрано в этой ветке
  done: boolean // ветка закончилась
}

export function startBranch(tree: QuestionTree): BranchState {
  const start = stepById(tree, tree.startNodeId)
  return { nodeId: tree.startNodeId, path: [], earned: 0, done: !start || start.options.length === 0 }
}

// Выбран вариант: баллы, следующий шаг, конец ли ветки
export function chooseOption(tree: QuestionTree, branch: BranchState, option: number): BranchState {
  const node = stepById(tree, branch.nodeId)
  const chosen = node?.options[option]
  if (!node || !chosen || branch.done) return branch
  const next = stepById(tree, chosen.nextNodeId)
  return {
    nodeId: next?.id ?? node.id,
    path: [...branch.path, { nodeId: node.id, option }],
    earned: branch.earned + chosen.points,
    done: !next || next.options.length === 0,
  }
}

// «+100», «−50», «0»
export function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0'
}
