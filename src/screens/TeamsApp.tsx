import { addTeam, MAX_TEAMS, moveTeam, removeTeam, renameTeam } from '../game'
import type { Game, Team } from '../types'
import { useSavedGame } from '../useSavedGame'

// Экран «Команды и игроки» (макет «Players»). Пока только команды: название, порядок, добавить, удалить.
// Участники, фото и случайное распределение — следующий этап.
// Открывается и перед игрой, и во время неё: счёт при правке команд не сбрасывается.
export default function TeamsApp({ initialGame }: { initialGame: Game }) {
  const { game, change, saved } = useSavedGame(initialGame)
  const { teams } = game
  const playHref = `#/play/${encodeURIComponent(game.id)}`

  function remove(team: Team) {
    if (!window.confirm(`Удалить команду «${team.name}»? Её счёт в текущей игре тоже пропадёт.`)) return
    change((g) => removeTeam(g, team.id))
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-3">
        <div className="flex flex-wrap items-baseline gap-4">
          <a href="#/" className="text-sm text-muted hover:text-white">
            ← Мои игры
          </a>
          <span className="font-display text-lg">КОМАНДЫ И ИГРОКИ</span>
          <span className="text-sm text-muted">{game.title} · можно открыть и во время игры</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm text-muted" aria-live="polite">
            {saved ? 'Все изменения сохранены' : 'Сохраняю…'}
          </span>
          <a
            href={`#/edit/${encodeURIComponent(game.id)}`}
            className="flex h-11 items-center rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            Вопросы
          </a>
          <a
            href={playHref}
            className="flex h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black hover:opacity-90"
          >
            К игре
          </a>
        </div>
      </header>

      <main className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-widest text-muted">
            КОМАНДЫ · {teams.length} из {MAX_TEAMS}
          </h2>
          <button
            type="button"
            onClick={() => change(addTeam)}
            disabled={teams.length >= MAX_TEAMS}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40"
          >
            + Команда
          </button>
        </div>

        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {teams.map((team, i) => (
            <div key={team.id} className="flex flex-col gap-2.5 rounded-xl border border-line p-3.5">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white font-display text-lg"
                  title={`На пульте — клавиша ${i === 9 ? 0 : i + 1}`}
                >
                  {i === 9 ? 0 : i + 1}
                </span>
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                  Название
                  <input
                    value={team.name}
                    onChange={(e) => {
                      const name = e.target.value
                      change((g) => renameTeam(g, team.id, name))
                    }}
                    onBlur={() => {
                      if (!team.name.trim()) change((g) => renameTeam(g, team.id, `Команда ${i + 1}`))
                    }}
                    className="h-10 rounded-lg border border-line bg-cell px-2.5 text-sm font-semibold text-white focus:border-white focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => change((g) => moveTeam(g, team.id, -1))}
                  disabled={i === 0}
                  aria-label={`Сдвинуть команду «${team.name}» левее`}
                  className="h-11 min-w-11 rounded-lg border border-line text-sm hover:bg-cell disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => change((g) => moveTeam(g, team.id, 1))}
                  disabled={i === teams.length - 1}
                  aria-label={`Сдвинуть команду «${team.name}» правее`}
                  className="h-11 min-w-11 rounded-lg border border-line text-sm hover:bg-cell disabled:opacity-40"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => remove(team)}
                  disabled={teams.length <= 1}
                  aria-label={`Удалить команду «${team.name}»`}
                  className="ml-auto h-11 rounded-lg border border-line px-3 text-sm hover:bg-cell disabled:opacity-40"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted">
          Номер команды — клавиша на пульте, которой ведущий выбирает отвечающих (0 — десятая команда). Названия сразу
          видны в зале, когда вы вернётесь к игре. Участники с фото и случайное распределение появятся на следующем шаге.
        </p>
      </main>
    </div>
  )
}
