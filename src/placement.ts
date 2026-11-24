import { columnsOf, contentMedia, layoutOf } from './pictures'
import type { Box, Content, PlaceTarget, Placement, Question } from './types'

// Своя расстановка слайда: ведущий сам ставит текст и картинки, куда хочет, и задаёт их размер.
// Всё в процентах от области вопроса в зале — так расстановка одинакова на любом экране.

const MIN_SIDE = 5 // объект не меньше 5% области — иначе его не ухватить мышью
const GAP = 2 // зазор между картинками в начальной расстановке, %

// Рамка не выходит за область и не бывает слишком маленькой
export function clampBox(box: Box): Box {
  const w = Math.min(100, Math.max(MIN_SIDE, box.w))
  const h = Math.min(100, Math.max(MIN_SIDE, box.h))
  return {
    x: round(Math.min(100 - w, Math.max(0, box.x))),
    y: round(Math.min(100 - h, Math.max(0, box.y))),
    w: round(w),
    h: round(h),
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

// Начальная расстановка — похожа на обычную: текст сверху, картинки под ним по шаблону слайда
export function defaultPlace(content: Content): Placement {
  const count = contentMedia(content).length
  const hasText = !!content.text
  const top = hasText ? (count > 0 ? 24 : 0) : 0
  const place: Placement = {}
  if (hasText) place.text = count > 0 ? { x: 0, y: 0, w: 100, h: 20 } : { x: 0, y: 30, w: 100, h: 40 }
  if (count > 0) place.media = Array.from({ length: count }, (_, i) => gridBox(content, i, top))
  return place
}

// Место i-й картинки в начальной сетке (в области от top до низа)
function gridBox(content: Content, index: number, top: number): Box {
  const count = contentMedia(content).length
  const area = { x: 0, y: top, w: 100, h: 100 - top }
  const layout = layoutOf(content)
  if (layout === 'big-left') {
    const bigW = (area.w - GAP) * (2 / 3)
    if (index === 0) return { x: area.x, y: area.y, w: bigW, h: area.h }
    const rest = count - 1
    const h = (area.h - GAP * (rest - 1)) / rest
    return { x: area.x + bigW + GAP, y: area.y + (index - 1) * (h + GAP), w: area.w - bigW - GAP, h }
  }
  const cols = Math.min(columnsOf(layout), count)
  const rows = Math.ceil(count / cols)
  const w = (area.w - GAP * (cols - 1)) / cols
  const h = (area.h - GAP * (rows - 1)) / rows
  const row = Math.floor(index / cols)
  const col = index % cols
  // Неполный последний ряд — по центру
  const inRow = Math.min(cols, count - row * cols)
  const shift = ((cols - inRow) * (w + GAP)) / 2
  return clampBox({ x: area.x + shift + col * (w + GAP), y: area.y + row * (h + GAP), w, h })
}

// Расстановка, которую показываем: своя, а для картинок без рамки (добавили позже) — место по умолчанию
export function placeOf(content: Content): Required<Placement> {
  const fallback = defaultPlace(content)
  const own = content.place ?? {}
  const count = contentMedia(content).length
  return {
    text: own.text ?? fallback.text ?? { x: 0, y: 0, w: 100, h: 20 },
    media: Array.from({ length: count }, (_, i) => own.media?.[i] ?? fallback.media![i]),
  }
}

// Что расставлено в этом месте вопроса
export function contentAt(question: Question, target: PlaceTarget): Content | undefined {
  if (target.kind === 'slide') return question.slides[target.index]
  if (target.kind === 'answer') return question.answer
  const node = question.tree?.nodes.find((n) => n.id === target.nodeId)
  return target.answer ? node?.answer : node?.content
}

// Поменять расстановку в нужном месте вопроса (undefined — вернуть обычную раскладку)
export function setContentPlace(question: Question, target: PlaceTarget, place: Placement | undefined): Question {
  const apply = (content: Content): Content => {
    const next = { ...content, place }
    if (!place) delete next.place
    return next
  }
  if (target.kind === 'slide') {
    return { ...question, slides: question.slides.map((s, i) => (i === target.index ? apply(s) : s)) }
  }
  if (target.kind === 'answer') return { ...question, answer: apply(question.answer) }
  if (!question.tree) return question
  return {
    ...question,
    tree: {
      ...question.tree,
      nodes: question.tree.nodes.map((n) => {
        if (n.id !== target.nodeId) return n
        return target.answer ? { ...n, answer: apply(n.answer ?? {}) } : { ...n, content: apply(n.content) }
      }),
    },
  }
}
