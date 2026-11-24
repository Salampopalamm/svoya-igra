import type { Content, MediaRef, PictureLayout } from './types'

// Несколько картинок на одном слайде (или в ответе): сколько можно и как их расставить.

export const MAX_PICTURES = 8 // всего на слайде, вместе с первой

// Все файлы слайда по порядку: первый (media) и ещё картинки (more)
export function contentMedia(content: Content): MediaRef[] {
  return [content.media, ...(content.more ?? [])].filter((m): m is MediaRef => !!m)
}

// Можно ли добавить к слайду ещё картинку: первая должна быть картинкой (музыка и видео — по одному на слайд)
export function canAddPicture(content: Content): boolean {
  const first = content.media
  return !!first && (first.type === 'image' || first.type === 'gif') && contentMedia(content).length < MAX_PICTURES
}

// Шаблоны: «по N в ряд» или «большая слева + остальные справа»
const COLUMNS: Record<Exclude<PictureLayout, 'big-left'>, number> = { 'cols-1': 1, 'cols-2': 2, 'cols-3': 3, 'cols-4': 4 }

export function columnsOf(layout: Exclude<PictureLayout, 'big-left'>): number {
  return COLUMNS[layout]
}

// Какие шаблоны подходят для этого числа картинок (строк — не больше трёх, чтобы картинки не были мелкими)
export function layoutsFor(count: number): PictureLayout[] {
  const grids = (Object.keys(COLUMNS) as Exclude<PictureLayout, 'big-left'>[]).filter((layout) => {
    const cols = COLUMNS[layout]
    return cols <= count && Math.ceil(count / cols) <= 3
  })
  return count >= 3 && count <= 5 ? [...grids, 'big-left'] : grids
}

// Шаблон по умолчанию: до трёх — в ряд, 4 — квадратом, 5–6 — по три, 7–8 — по четыре
export function defaultLayout(count: number): PictureLayout {
  if (count <= 3) return count === 1 ? 'cols-1' : (`cols-${count}` as PictureLayout)
  if (count === 4) return 'cols-2'
  if (count <= 6) return 'cols-3'
  return 'cols-4'
}

// Шаблон слайда: выбранный, если он подходит к числу картинок, иначе — по умолчанию
export function layoutOf(content: Content): PictureLayout {
  const count = contentMedia(content).length
  return content.layout && layoutsFor(count).includes(content.layout) ? content.layout : defaultLayout(count)
}

// Подпись шаблона в редакторе: «3 в ряд», «2 × 2», «Большая + 3»
export function layoutName(layout: PictureLayout, count: number): string {
  if (layout === 'big-left') return `Большая + ${count - 1}`
  const cols = COLUMNS[layout]
  const rows = Math.ceil(count / cols)
  if (rows === 1) return `${count} в ряд`
  if (cols === 1) return `${count} столбиком`
  if (count % cols === 0) return `${cols} × ${rows}`
  // Неполный последний ряд: «2 + 1», «3 + 2», «2 + 2 + 1»
  return Array.from({ length: rows }, (_, r) => Math.min(cols, count - r * cols)).join(' + ')
}

// Убрать картинку из слайда; если убрали первую — её место занимает следующая
export function withoutPicture(content: Content, index: number): Content {
  const rest = contentMedia(content).filter((_, i) => i !== index)
  const [media, ...more] = rest
  const next: Content = { ...content, media, more: more.length > 0 ? more : undefined }
  if (!media) delete next.media
  // Своя расстановка: рамка убранной картинки уходит вместе с ней, остальные стоят на местах
  if (content.place?.media) next.place = { ...content.place, media: content.place.media.filter((_, i) => i !== index) }
  if (more.length === 0) {
    delete next.more
    delete next.layout
  }
  return next
}
