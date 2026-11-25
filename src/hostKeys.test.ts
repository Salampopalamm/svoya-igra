import { describe, expect, it } from 'vitest'
import { hostKey } from './hostKeys'

const key = (code: string, key = '', ctrlKey = false) => ({ code, key, ctrlKey })
const board = { questionOpen: false, isFinal: false }
const question = { questionOpen: true, isFinal: false }
const final = { questionOpen: true, isFinal: true }

describe('горячие клавиши пульта', () => {
  it('Ctrl+Z — отмена; другие сочетания с Ctrl пульт не трогает (Ctrl+T — новая вкладка, а не таймер)', () => {
    expect(hostKey(key('KeyZ', 'z', true), board)).toEqual({ kind: 'undo' })
    expect(hostKey(key('KeyT', 't', true), question)).toBeNull()
    expect(hostKey(key('Digit1', '1', true), board)).toBeNull()
  })
  it('цифры — команда по номеру, 0 — десятая; в финале цифры молчат', () => {
    expect(hostKey(key('Digit1', '1'), board)).toEqual({ kind: 'team', index: 0 })
    expect(hostKey(key('Numpad3', '3'), question)).toEqual({ kind: 'team', index: 2 })
    expect(hostKey(key('Digit0', '0'), board)).toEqual({ kind: 'team', index: 9 })
    expect(hostKey(key('Digit1', '1'), final)).toBeNull()
  })
  it('P — предпросмотр только на табло', () => {
    expect(hostKey(key('KeyP', 'p'), board)).toEqual({ kind: 'preview-mode' })
    expect(hostKey(key('KeyP', 'p'), question)).toBeNull()
  })
  it('слайды, таймер, ответ, «Верно / Неверно» — только в открытом вопросе', () => {
    for (const code of ['ArrowRight', 'ArrowLeft', 'KeyT', 'Space']) expect(hostKey(key(code), board)).toBeNull()
    expect(hostKey(key('ArrowLeft'), question)).toEqual({ kind: 'slide', delta: -1 })
    expect(hostKey(key('KeyT', 't'), question)).toEqual({ kind: 'timer' })
    expect(hostKey(key('Space', ' '), question)).toEqual({ kind: 'answer' })
    expect(hostKey(key('Equal', '='), question)).toEqual({ kind: 'correct' }) // «+» без Shift
    expect(hostKey(key('NumpadAdd', '+'), question)).toEqual({ kind: 'correct' })
    expect(hostKey(key('Minus', '-'), question)).toEqual({ kind: 'wrong' })
    expect(hostKey(key('Equal', '='), board)).toBeNull()
  })
  it('H и Esc работают всегда; по русской раскладке — тоже (смотрим на место клавиши, а не на букву)', () => {
    expect(hostKey(key('KeyH', 'р'), board)).toEqual({ kind: 'toggle-screen' })
    expect(hostKey(key('KeyT', 'е'), question)).toEqual({ kind: 'timer' })
    expect(hostKey(key('Escape', 'Escape'), final)).toEqual({ kind: 'escape' })
  })
})
