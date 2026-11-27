import { describe, expect, it } from 'vitest'
import { storageErrorText } from './storageError'

const error = (name: string, inner?: string) => Object.assign(new Error('x'), { name, ...(inner ? { inner: { name: inner } } : {}) })

describe('почему игра не сохранилась', () => {
  it('закончилось место (и когда браузер прячет причину внутрь ошибки)', () => {
    expect(storageErrorText(error('QuotaExceededError'))).toMatch(/закончилось место/)
    expect(storageErrorText(error('AbortError', 'QuotaExceededError'))).toMatch(/закончилось место/)
  })

  it('сайт обновился в другой вкладке — хранилище закрыто', () => {
    expect(storageErrorText(error('DatabaseClosedError'))).toMatch(/обновился в другой вкладке/)
    expect(storageErrorText(error('VersionError'))).toMatch(/обновился в другой вкладке/)
  })

  it('любая другая причина — общий совет', () => {
    expect(storageErrorText(error('UnknownError'))).toMatch(/не дал записать/)
    expect(storageErrorText('что-то странное')).toMatch(/не дал записать/)
  })
})
