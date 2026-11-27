// Почему браузер не записал игру — понятным языком (для плашки «Не сохранилось»)
export function storageErrorText(e: unknown): string {
  const name = e instanceof Error ? e.name : ''
  const inner = (e as { inner?: { name?: string } } | null)?.inner?.name ?? ''
  if (name === 'QuotaExceededError' || inner === 'QuotaExceededError') {
    return 'в браузере закончилось место. Сохраните копию файлом и уберите ненужные файлы в «Моих играх»'
  }
  if (['DatabaseClosedError', 'VersionError', 'InvalidStateError'].includes(name)) {
    return 'сайт обновился в другой вкладке. Сохраните копию файлом и обновите страницу (F5)'
  }
  return 'браузер не дал записать игру. Сохраните копию файлом и обновите страницу (F5)'
}
