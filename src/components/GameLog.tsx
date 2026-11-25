import { formatClock, KIND_NAMES, logToCsv, teamStats, type LogEntry } from '../log'
import type { Game } from '../types'

// Журнал партии на пульте: итоги команд и каждое изменение счёта с причиной.
// Только у ведущего — в зал не попадает. «Сохранить в Excel» — файл .csv для клиента.

type Props = { game: Game; log: LogEntry[]; rehearsal: boolean; onClose: () => void }

export default function GameLog({ game, log, rehearsal, onClose }: Props) {
  const stats = teamStats(game, log)
  const teamName = (id?: string) => game.teams.find((t) => t.id === id)?.name ?? '—'

  function download() {
    const blob = new Blob([logToCsv(game, log)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${game.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'игра'} — журнал.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      {/* Клик мимо панели — закрыть */}
      <button type="button" aria-label="Закрыть журнал" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-black/50" />
      <aside
        role="dialog"
        aria-label="Журнал партии"
        className="fixed inset-y-0 right-0 z-50 flex w-[640px] max-w-full flex-col gap-6 overflow-y-auto border-l border-line bg-bg p-6 text-white shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">ЖУРНАЛ ПАРТИИ</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={download}
              disabled={log.length === 0}
              className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-50"
            >
              Сохранить в Excel
            </button>
            <button type="button" onClick={onClose} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
              Закрыть · Esc
            </button>
          </div>
        </div>
        {rehearsal && <p className="text-sm text-muted">Идёт репетиция: когда она закончится, журнал вернётся таким, каким был до неё.</p>}

        <table className="w-full text-sm">
          <thead className="text-left text-xs tracking-widest text-muted">
            <tr>
              <th className="py-1 font-semibold">КОМАНДА</th>
              <th className="py-1 text-right font-semibold">ВЕРНО</th>
              <th className="py-1 text-right font-semibold">НЕВЕРНО</th>
              <th className="py-1 text-right font-semibold" title="Самая длинная серия верных ответов подряд">
                СЕРИЯ
              </th>
              <th className="py-1 text-right font-semibold">СЧЁТ</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.team.id} className="border-t border-line">
                <td className="py-2">{s.team.name}</td>
                <td className="py-2 text-right">{s.correct}</td>
                <td className="py-2 text-right">{s.wrong}</td>
                <td className="py-2 text-right">{s.bestStreak}</td>
                <td className="py-2 text-right font-semibold">
                  {s.team.score}
                  {s.manual !== 0 && (
                    <span className="block text-xs font-normal text-muted">
                      поправки {s.manual > 0 ? '+' : ''}
                      {s.manual}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-widest text-muted">ПО ПОРЯДКУ · СНАЧАЛА СВЕЖИЕ</h3>
          {log.length === 0 ? (
            <p className="text-sm text-muted">Пока пусто: здесь появится каждый ответ и каждая поправка счёта.</p>
          ) : (
            <ol className="flex flex-col">
              {[...log].reverse().map((e, i) => (
                <li key={log.length - i} className="flex items-baseline gap-3 border-t border-line py-2 text-sm">
                  <span className="w-12 shrink-0 text-muted">{formatClock(e.at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{e.teamId ? teamName(e.teamId) : KIND_NAMES[e.kind]}</span>
                    {e.teamId && <span className="text-muted"> · {KIND_NAMES[e.kind]}</span>}
                    {e.where && <span className="text-muted"> · {e.where}</span>}
                    {e.note && <span className="block text-xs text-muted">{e.note}</span>}
                  </span>
                  <span className={`shrink-0 font-semibold ${e.points < 0 ? 'text-played' : ''}`}>
                    {e.points > 0 ? '+' : ''}
                    {e.teamId ? e.points : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </>
  )
}
