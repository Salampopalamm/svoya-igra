import { useEffect, useRef, useState } from 'react'
import { exportFileName, exportGame, markExported } from '../gameFile'
import type { Game } from '../types'

// Кнопка «💾 Сохранить» в шапке редактора и экрана «Команды» (и Ctrl+S).
// Игра и так сама сохраняется в браузере после каждой правки — кнопка дождётся этого и сохранит
// копию файлом (.zip) на компьютер: её не сотрёт очистка браузера, её можно открыть на другом ноутбуке.
// Если браузер не смог записать правку, внизу экрана — плашка с причиной и «Попробовать снова».
export default function SaveButton({ game, saved, error, onRetry, flush }: {
  game: Game
  saved: boolean // все правки записаны в браузер
  error: string | null // браузер не записал правку
  onRetry: () => void
  flush: () => Promise<void> // дождаться последней записи
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; failed?: boolean } | null>(null)

  async function saveCopy() {
    if (busy) return
    setBusy(true)
    setResult(null)
    try {
      await flush()
      const zip = await exportGame(game)
      const url = URL.createObjectURL(zip)
      const link = document.createElement('a')
      link.href = url
      link.download = exportFileName(game)
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      markExported(game.id)
      const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      setResult({ text: `✓ Копия «${exportFileName(game)}» — в папке «Загрузки» · ${time}` })
    } catch {
      setResult({ text: 'Копия не сохранилась: закройте другие вкладки и попробуйте ещё раз', failed: true })
    } finally {
      setBusy(false)
    }
  }

  // Ctrl+S (на Mac — Cmd+S): вместо «Сохранить страницу» браузера — копия игры
  const saveRef = useRef(saveCopy)
  useEffect(() => {
    saveRef.current = saveCopy
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <span className={`text-sm ${error ? 'font-semibold text-white' : 'text-muted'}`} aria-live="polite">
        {error ? '⚠ Не сохранилось' : saved ? 'Все изменения сохранены' : 'Сохраняю…'}
      </span>
      <button
        type="button"
        onClick={() => void saveCopy()}
        disabled={busy}
        title="Игра сама сохраняется в этом браузере. Кнопка сохраняет ещё и копию файлом на компьютер — её не сотрёт очистка браузера (Ctrl+S)"
        className="h-11 rounded-lg border border-white px-4 font-semibold hover:bg-white hover:text-black disabled:opacity-60"
      >
        {busy ? 'Сохраняю копию…' : '💾 Сохранить'}
      </button>

      {/* Что получилось — внизу экрана, чтобы не сдвигать шапку */}
      {(error || result) && (
        <div role={error || result?.failed ? 'alert' : 'status'} className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className={`flex max-w-3xl flex-wrap items-center gap-3 rounded-xl px-5 py-3 shadow-2xl ${error || result?.failed ? 'border-2 border-white bg-cell' : 'border border-line bg-cell'}`}>
            <span className="min-w-0 flex-1">{error ? `⚠ Последняя правка не сохранилась: ${error}.` : result?.text}</span>
            {error && (
              <>
                <button type="button" onClick={onRetry} className="h-11 rounded-lg bg-white px-4 font-semibold text-black hover:opacity-90">
                  Попробовать снова
                </button>
                <button type="button" onClick={() => void saveCopy()} disabled={busy} className="h-11 rounded-lg border border-white px-4 hover:bg-bg">
                  💾 Копия файлом
                </button>
              </>
            )}
            {!error && (
              <button type="button" onClick={() => setResult(null)} aria-label="Закрыть сообщение" className="h-11 min-w-11 rounded-lg border border-line px-3 hover:bg-bg">
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
