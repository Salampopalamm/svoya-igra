import type { BalanceNote } from '../balance'
import { plural } from '../plural'
import type { Game, PlayRules } from '../types'

// Баланс в редакторе (balance.ts): советы, чтобы одна команда не отрывалась, и правила партии.

// Проверка баланса: советы, а не ошибки — играть можно и так. Клик по совету открывает его раунд.
export function BalanceCheck({ game, notes, onShow, onScaleUp }: {
  game: Game
  notes: BalanceNote[]
  onShow: (note: BalanceNote) => void
  onScaleUp: (roundId: string) => void // «Цены ×2» у раунда, где цены не растут
}) {
  if (notes.length === 0) {
    return <p className="text-sm text-muted">⚖ Баланс: ходов у команд поровну, цены от раунда к раунду растут.</p>
  }
  const roundTitle = (id?: string) => game.rounds.find((r) => r.id === id)?.title
  const categoryTitle = (id?: string) => game.rounds.flatMap((r) => r.categories).find((c) => c.id === id)?.title
  return (
    <section aria-label="Проверка баланса" className="flex flex-col gap-2 rounded-xl border border-line p-4">
      <h2 className="font-semibold">
        ⚖ Баланс: {notes.length} {plural(notes.length, 'совет', 'совета', 'советов')}
        <span className="ml-2 text-sm font-normal text-muted">— чтобы одна команда не отрывалась; играть можно и так</span>
      </h2>
      <ul className="flex flex-col">
        {notes.map((note, i) => {
          const where = [game.rounds.length > 1 ? roundTitle(note.roundId) : null, categoryTitle(note.categoryId)].filter(Boolean).join(' · ')
          return (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onShow(note)}
                className="min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-cell"
              >
                {where && <span className="text-muted">{where} — </span>}
                {note.text}
              </button>
              {note.scaleUp && note.roundId && (
                <button
                  type="button"
                  onClick={() => onScaleUp(note.roundId!)}
                  className="h-11 rounded-lg border border-white px-4 text-sm font-semibold hover:bg-white hover:text-black"
                >
                  Цены этого раунда ×2
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Правила партии: кто начинает новый раунд и сколько стоит перехват
export function PlayRulesEditor({ rules, onChange }: { rules: PlayRules | undefined; onChange: (rules: PlayRules) => void }) {
  const roundStart = rules?.roundStart ?? 'last'
  const steal = rules?.steal ?? 'full'
  const set = (patch: PlayRules) => {
    const next: PlayRules = { ...rules, ...patch }
    if (next.roundStart === 'last') delete next.roundStart // значения по умолчанию не храним
    if (next.steal === 'full') delete next.steal
    onChange(next)
  }
  const chip = (on: boolean) => `h-11 rounded-lg px-4 text-sm ${on ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`
  return (
    <section aria-label="Правила партии" className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <h2 className="text-sm font-semibold tracking-widest text-muted">⚖ ПРАВИЛА ПАРТИИ · ЧТОБЫ ОДНА КОМАНДА НЕ ОТРЫВАЛАСЬ</h2>
      <div role="group" aria-label="Кто начинает новый раунд" className="flex flex-wrap items-center gap-2">
        <span className="w-48 text-sm text-muted">Новый раунд начинает</span>
        <button type="button" onClick={() => set({ roundStart: 'last' })} aria-pressed={roundStart === 'last'} className={chip(roundStart === 'last')}>
          отстающая команда
        </button>
        <button type="button" onClick={() => set({ roundStart: 'continue' })} aria-pressed={roundStart === 'continue'} className={chip(roundStart === 'continue')}>
          следующая по кругу
        </button>
      </div>
      <div role="group" aria-label="Сколько стоит перехват" className="flex flex-wrap items-center gap-2">
        <span className="w-48 text-sm text-muted">Перехват</span>
        <button type="button" onClick={() => set({ steal: 'full' })} aria-pressed={steal === 'full'} className={chip(steal === 'full')}>
          за полную стоимость
        </button>
        <button type="button" onClick={() => set({ steal: 'half' })} aria-pressed={steal === 'half'} className={chip(steal === 'half')}>
          за половину
        </button>
      </div>
      <p className="text-sm text-muted">
        {roundStart === 'last'
          ? 'Когда ведущий переходит к новому раунду, ход получает команда с самым маленьким счётом (как на ТВ). '
          : 'Ход между раундами просто идёт дальше по кругу. '}
        {steal === 'half'
          ? 'Перехват приносит половину стоимости, неверный перехват — минус половина: сильная команда не забирает всё подряд.'
          : 'Перехват — за полную стоимость, неверный перехват — полный минус.'}
      </p>
    </section>
  )
}
