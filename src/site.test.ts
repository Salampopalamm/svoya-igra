import { describe, expect, it } from 'vitest'
import { buildVersion, issueUrl } from './site'

describe('ссылка на анкету замечания', () => {
  it('шаблон и версия, версия закодирована', () => {
    expect(issueUrl('bug.yml', '27.11 · 96da391')).toBe(
      'https://github.com/Salampopalamm/svoya-igra/issues/new?template=bug.yml&version=27.11%20%C2%B7%2096da391',
    )
  })
  it('нет версии — без поля версии', () => {
    expect(issueUrl('idea.yml', '')).toBe('https://github.com/Salampopalamm/svoya-igra/issues/new?template=idea.yml')
  })
})

describe('версия сайта в метке DEV', () => {
  it('дата дд.мм и номер коммита', () => {
    expect(buildVersion('96da391', '2026-11-27')).toBe('27.11 · 96da391')
  })
  it('нет git — пусто, нет даты — только номер', () => {
    expect(buildVersion('', '')).toBe('')
    expect(buildVersion('96da391', '')).toBe('96da391')
  })
})
