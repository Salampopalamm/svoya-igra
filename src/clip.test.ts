import { describe, expect, it } from 'vitest'
import { cleanClip, describeClip, formatClipTime, outsideClip, parseClipTime, withClip } from './clip'
import { repairGame } from './repairGame'
import { cat, game, q, round } from './testing'

describe('фрагмент музыки и видео', () => {
  it('время словами и обратно', () => {
    expect(parseClipTime('1:05')).toBe(65)
    expect(parseClipTime('45')).toBe(45)
    expect(parseClipTime('1:05,5')).toBe(65.5)
    expect(parseClipTime('1:02:03')).toBe(3723)
    expect(parseClipTime('')).toBeNull()
    expect(parseClipTime('пять')).toBeNull()
    expect(parseClipTime('1:-5')).toBeNull()
    expect(formatClipTime(65)).toBe('1:05')
    expect(formatClipTime(65.5)).toBe('1:05,5')
    expect(formatClipTime(0)).toBe('0:00')
  })
  it('фрагмент без ошибок: начало с нуля — не начало, конец раньше начала — убираем', () => {
    expect(cleanClip({ start: 0, end: 30 })).toEqual({ end: 30 })
    expect(cleanClip({ start: 40, end: 30 })).toEqual({ start: 40 })
    expect(cleanClip({ start: 0 })).toBeUndefined()
    expect(withClip({ id: 'm', type: 'audio', name: 'трек.mp3', clip: { start: 5 } }, undefined)).toEqual({ id: 'm', type: 'audio', name: 'трек.mp3' })
  })
  it('запуск вне фрагмента — с начала; внутри — с того же места', () => {
    const clip = { start: 45, end: 65 }
    expect(outsideClip(clip, 0)).toBe(true)
    expect(outsideClip(clip, 50)).toBe(false)
    expect(outsideClip(clip, 65)).toBe(true)
    expect(outsideClip(undefined, 0)).toBe(false)
  })
  it('словами', () => {
    expect(describeClip({ start: 45, end: 65 })).toBe('с 0:45 до 1:05')
    expect(describeClip({ start: 45 })).toBe('с 0:45 до конца')
    expect(describeClip({ end: 10 })).toBe('с начала до 0:10')
    expect(describeClip(undefined)).toBeNull()
  })
  it('починка игры: фрагмент музыки сохраняется, у картинки — выбрасывается', () => {
    const music = q(100, { slides: [{ media: { id: 'm1', type: 'audio', name: 'трек.mp3', clip: { start: 45, end: 65 } } }] })
    const photo = q(200, { slides: [{ media: { id: 'm2', type: 'image', name: 'фото.jpg', clip: { start: 5 } } }] })
    const repaired = repairGame(game([round([cat('Музыка', [music, photo])])]))!
    const [a, b] = repaired.rounds[0].categories[0].questions
    expect(a.slides[0].media?.clip).toEqual({ start: 45, end: 65 })
    expect(b.slides[0].media?.clip).toBeUndefined()
  })
})
