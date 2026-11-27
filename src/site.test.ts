import { describe, expect, it } from 'vitest'
import { buildVersion } from './site'

describe('версия сайта в метке DEV', () => {
  it('дата дд.мм и номер коммита', () => {
    expect(buildVersion('96da391', '2026-11-27')).toBe('27.11 · 96da391')
  })
  it('нет git — пусто, нет даты — только номер', () => {
    expect(buildVersion('', '')).toBe('')
    expect(buildVersion('96da391', '')).toBe('96da391')
  })
})
