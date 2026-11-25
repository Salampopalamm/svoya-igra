import { describe, expect, it } from 'vitest'
import { formatTime, newTimer, pauseTimer, startTimer, timeLeft } from './live'
import { clampSize, itemVar } from './theme'

describe('таймер вопроса', () => {
  it('у вопроса без времени таймера нет', () => {
    expect(newTimer(undefined)).toBeNull()
    expect(newTimer(0)).toBeNull()
  })
  it('пуск, пауза, продолжение — остаток считается верно', () => {
    let t = newTimer(30)!
    expect(timeLeft(t, 0)).toBe(30_000)
    t = startTimer(t, 1_000) // пустили в 1 с
    expect(timeLeft(t, 11_000)).toBe(20_000) // прошло 10 с
    t = pauseTimer(t, 11_000)
    expect(timeLeft(t, 99_000)).toBe(20_000) // на паузе время стоит
    t = startTimer(t, 100_000)
    expect(timeLeft(t, 105_000)).toBe(15_000)
    expect(timeLeft(t, 200_000)).toBe(0) // не уходит в минус
  })
  it('время вышло — следующий пуск начинает сначала', () => {
    const over = pauseTimer(startTimer(newTimer(10)!, 0), 50_000)
    expect(timeLeft(startTimer(over, 60_000), 60_000)).toBe(10_000)
  })
  it('время словами: 0:00 появляется ровно в конце', () => {
    expect([formatTime(75_000), formatTime(500), formatTime(0), formatTime(9_001)]).toEqual(['1:15', '0:01', '0:00', '0:10'])
  })
})

describe('размеры в зале', () => {
  it('размер — от 50 до 200 %, шагом 10', () => {
    expect([12, 155, 154, 999, 100].map(clampSize)).toEqual([50, 160, 150, 200, 100])
  })
  it('имя CSS-переменной без недопустимых знаков', () => {
    expect(itemVar('cell:q-1')).toBe('--i-cell_q-1')
  })
})
