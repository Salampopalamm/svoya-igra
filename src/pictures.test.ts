import { describe, expect, it } from 'vitest'
import { canAddPicture, contentMedia, defaultLayout, layoutName, layoutOf, layoutsFor, withoutPicture } from './pictures'
import { clampBox, defaultPlace, placeOf, setContentPlace } from './placement'
import { picture, q } from './testing'
import type { Content } from './types'

describe('несколько картинок на слайде', () => {
  const [a, b, c] = [picture('а'), picture('б'), picture('в')]

  it('убрали первую — её место занимает следующая', () => {
    const next = withoutPicture({ text: 'т', media: a, more: [b, c], layout: 'cols-3' }, 0)
    expect(contentMedia(next)).toEqual([b, c])
    expect(next.layout).toBe('cols-3')
  })
  it('осталась одна — шаблон и «ещё картинки» убираются', () => {
    const next = withoutPicture({ media: a, more: [b], layout: 'cols-2' }, 1)
    expect(next).toEqual({ media: a })
  })
  it('убрали последнюю — слайд без файла', () => {
    expect(withoutPicture({ text: 'т', media: a }, 0)).toEqual({ text: 'т' })
  })
  it('своя расстановка: рамка убранной картинки уходит, остальные на местах', () => {
    const place = { text: { x: 0, y: 0, w: 100, h: 20 }, media: [{ x: 0, y: 30, w: 40, h: 40 }, { x: 50, y: 30, w: 40, h: 40 }] }
    const next = withoutPicture({ media: a, more: [b], place }, 0)
    expect(next.place).toEqual({ text: place.text, media: [place.media[1]] })
  })
  it('к музыке и видео картинки не добавляются, больше 8 — тоже', () => {
    expect(canAddPicture({ media: { id: 'м', type: 'audio', name: 'песня.mp3' } })).toBe(false)
    expect(canAddPicture({ media: a, more: Array.from({ length: 7 }, () => picture()) })).toBe(false)
    expect(canAddPicture({ media: a })).toBe(true)
  })
  it('шаблоны: подходящие по числу картинок, неподходящий выбор заменяется обычным', () => {
    expect(layoutsFor(4)).toEqual(['cols-2', 'cols-3', 'cols-4', 'big-left'])
    expect([1, 2, 4, 5, 8].map(defaultLayout)).toEqual(['cols-1', 'cols-2', 'cols-2', 'cols-3', 'cols-4'])
    expect(layoutOf({ media: a, more: [b], layout: 'cols-4' })).toBe('cols-2')
    expect([layoutName('cols-3', 5), layoutName('cols-2', 4), layoutName('big-left', 4)]).toEqual(['3 + 2', '2 × 2', 'Большая + 3'])
  })
})

describe('своя расстановка (placement)', () => {
  it('рамка не выходит за экран и не меньше 5%', () => {
    expect(clampBox({ x: 90, y: -10, w: 30, h: 2 })).toEqual({ x: 70, y: 0, w: 30, h: 5 })
  })
  it('начальная расстановка: текст сверху, две картинки рядом под ним', () => {
    const place = defaultPlace({ text: 'Вопрос', media: picture(), more: [picture()] })
    expect(place.text).toEqual({ x: 0, y: 0, w: 100, h: 20 })
    expect(place.media).toHaveLength(2)
    const [left, right] = place.media!
    expect(left.y).toBe(24)
    expect(right.x).toBeGreaterThan(left.x + left.w)
  })
  it('картинку добавили после расстановки — она встаёт на место по умолчанию', () => {
    const own = { x: 10, y: 10, w: 30, h: 30 }
    const content: Content = { media: picture(), more: [picture()], place: { media: [own] } }
    const shown = placeOf(content)
    expect(shown.media[0]).toEqual(own)
    expect(shown.media[1]).toEqual(defaultPlace(content).media![1])
  })
  it('расстановка ставится на нужный слайд и снимается', () => {
    const question = q(100, { slides: [{ text: '1' }, { text: '2' }] })
    const box = { x: 0, y: 0, w: 50, h: 50 }
    const placed = setContentPlace(question, { kind: 'slide', index: 1 }, { text: box })
    expect(placed.slides[0].place).toBeUndefined()
    expect(placed.slides[1].place).toEqual({ text: box })
    expect('place' in setContentPlace(placed, { kind: 'slide', index: 1 }, undefined).slides[1]).toBe(false)
  })
})
