import { useState, type ReactNode } from 'react'
import PlayerAvatar from '../components/PlayerAvatar'
import PlayersList from '../components/PlayersList'
import TeamIcon from '../components/TeamIcon'
import { addMediaFile, deleteMediaIfUnused } from '../db'
import SaveButton from '../components/SaveButton'
import {
  addPlayers,
  addTeam,
  distributeRandomly,
  MAX_TEAMS,
  moveTeam,
  removeTeam,
  renameTeam,
  TEAM_EMOJI,
  updatePlayer,
  updateTeam,
} from '../game'
import type { Game, MediaRef, Player, Team } from '../types'
import { useSavedGame } from '../useSavedGame'

type Change = (update: (g: Game) => Game) => void

const ghostButton = 'h-11 min-w-11 rounded-lg border border-line px-3 text-sm hover:bg-cell disabled:opacity-40'

// Экран «Команды и игроки» (макет «Players»): слева общий список участников, справа команды.
// Открывается и перед игрой, и во время неё: счёт при правке команд не сбрасывается.
export default function TeamsApp({ initialGame }: { initialGame: Game }) {
  const { game, change, saved, error, retry, flush, dropMedia } = useSavedGame(initialGame)
  const { teams, players } = game
  const unassigned = players.filter((p) => !teams.some((t) => t.id === p.teamId))

  function remove(team: Team) {
    const members = players.filter((p) => p.teamId === team.id).length
    const note = members > 0 ? ` Её участники (${members}) останутся без команды.` : ''
    if (!window.confirm(`Удалить команду «${team.name}»?${note} Её счёт в текущей игре тоже пропадёт.`)) return
    change((g) => removeTeam(g, team.id))
  }

  function shuffleTeams() {
    const manual = players.some((p) => !p.locked && p.teamId)
    if (manual && !window.confirm('Перемешать заново? Все, кроме капитанов, окажутся в новых командах.')) return
    change((g) => distributeRandomly(g))
  }

  // Перетаскивание игрока: в команду (teamId) или в «Без команды» (undefined)
  function moveTo(playerId: string, teamId: string | undefined) {
    change((g) => updatePlayer(g, playerId, (p) => ({ ...p, teamId })))
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
          <SaveButton game={game} saved={saved} error={error} onRetry={retry} flush={flush} />
          <a href={`#/edit/${encodeURIComponent(game.id)}`} className={`flex items-center ${ghostButton}`}>
            Вопросы
          </a>
          <a
            href={`#/play/${encodeURIComponent(game.id)}`}
            className="flex h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black hover:opacity-90"
          >
            К игре
          </a>
        </div>
      </header>

      <main className="grid flex-1 gap-6 p-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))' }}>
        <PlayersList game={game} change={change} dropMedia={dropMedia} />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-widest text-muted">
              КОМАНДЫ · {teams.length} из {MAX_TEAMS}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={shuffleTeams}
                disabled={players.length === 0}
                className="h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-40"
              >
                Распределить случайно
              </button>
              <button
                type="button"
                onClick={() => change(addTeam)}
                disabled={teams.length >= MAX_TEAMS}
                className={ghostButton}
              >
                + Команда
              </button>
            </div>
          </div>

          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {teams.map((team, i) => (
              <TeamCard
                key={team.id}
                team={team}
                index={i}
                count={teams.length}
                members={players.filter((p) => p.teamId === team.id)}
                change={change}
                onRemove={() => remove(team)}
                onDropPlayer={(playerId) => moveTo(playerId, team.id)}
                onMediaRemoved={(id) => dropMedia(id)}
              />
            ))}
          </div>

          {unassigned.length > 0 && (
            <DropZone onDropPlayer={(playerId) => moveTo(playerId, undefined)} className="rounded-xl border border-dashed border-line p-3.5">
              <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted">БЕЗ КОМАНДЫ · {unassigned.length}</h3>
              <PlayerChips players={unassigned} />
            </DropZone>
          )}

          <p className="text-sm text-muted">
            Игроков можно перетаскивать между командами. Номер команды — клавиша на пульте, которой ведущий выбирает
            отвечающих (0 — десятая). Названия сразу видны в зале, когда вы вернётесь к игре.
          </p>
        </section>
      </main>
    </div>
  )
}

// Выбор значка: эмодзи из набора, своя картинка или «без значка». Значок у команды один.
function IconPicker({ team, onPick }: {
  team: Team
  onPick: (icon: { emoji?: string; logo?: MediaRef }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const ref = await addMediaFile(file)
      if (ref.type !== 'image' && ref.type !== 'gif') {
        await deleteMediaIfUnused(ref.id) // не картинка — сразу убираем из хранилища
        throw new Error('Для значка нужна картинка: jpg, png или gif.')
      }
      onPick({ logo: ref })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить картинку.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-cell p-2.5">
      <div role="group" aria-label="Эмодзи для значка" className="grid grid-cols-6 gap-1">
        {TEAM_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick({ emoji })}
            aria-pressed={!team.logo && team.emoji === emoji}
            className={`flex h-11 items-center justify-center rounded-lg text-2xl ${!team.logo && team.emoji === emoji ? 'bg-white' : 'hover:bg-bg'}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={`${ghostButton} flex cursor-pointer items-center focus-within:border-white`}>
          {busy ? 'Сохраняю…' : team.logo ? 'Заменить картинку' : 'Своя картинка…'}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {(team.emoji || team.logo) && (
          <button type="button" onClick={() => onPick({})} className={ghostButton}>
            Без значка
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

// Карточка команды: название, значок, размер, игроки, «+ игрок», порядок, удалить
function TeamCard({ team, index, count, members, change, onRemove, onDropPlayer, onMediaRemoved }: {
  team: Team
  index: number
  count: number
  members: Player[]
  change: Change
  onRemove: () => void
  onDropPlayer: (playerId: string) => void
  onMediaRemoved: (mediaId: string) => void // картинку-значок убрали — её можно удалить из хранилища
}) {
  const [picking, setPicking] = useState(false) // открыт выбор значка
  const [adding, setAdding] = useState(false) // открыто поле «+ игрок»
  const [newName, setNewName] = useState('')
  const [sizeText, setSizeText] = useState(team.targetSize ? String(team.targetSize) : '')

  function changeSize(text: string) {
    setSizeText(text)
    const size = Number(text)
    const targetSize = text.trim() !== '' && Number.isInteger(size) && size > 0 ? size : undefined
    if (text.trim() === '' || targetSize) change((g) => updateTeam(g, team.id, (t) => ({ ...t, targetSize })))
  }

  return (
    <DropZone onDropPlayer={onDropPlayer} className="flex flex-col gap-2.5 rounded-xl border border-line p-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white font-display text-lg"
          title={`На пульте — клавиша ${index === 9 ? 0 : index + 1}`}
        >
          {index === 9 ? 0 : index + 1}
        </span>
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
          aria-label={`Значок команды «${team.name}»`}
          title="Значок команды"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs text-muted ${team.emoji || team.logo ? 'hover:bg-cell' : 'border border-dashed border-muted hover:bg-cell'}`}
        >
          {team.emoji || team.logo ? <TeamIcon team={team} size={36} /> : 'значок'}
        </button>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Название
          <input
            value={team.name}
            onChange={(e) => {
              const name = e.target.value
              change((g) => renameTeam(g, team.id, name))
            }}
            onBlur={() => {
              if (!team.name.trim()) change((g) => renameTeam(g, team.id, `Команда ${index + 1}`))
            }}
            className="h-10 rounded-lg border border-line bg-cell px-2.5 text-sm font-semibold text-white focus:border-white focus:outline-none"
          />
        </label>
      </div>

      {picking && (
        <IconPicker
          team={team}
          onPick={(icon) => {
            const oldLogo = team.logo
            change((g) => updateTeam(g, team.id, (t) => ({ ...t, emoji: icon.emoji, logo: icon.logo })))
            if (oldLogo && oldLogo.id !== icon.logo?.id) onMediaRemoved(oldLogo.id)
            setPicking(false)
          }}
        />
      )}

      <label className="flex items-center justify-between gap-2 text-sm text-muted">
        Размер (пусто — поровну)
        <input
          inputMode="numeric"
          value={sizeText}
          onChange={(e) => changeSize(e.target.value)}
          onBlur={() => setSizeText(team.targetSize ? String(team.targetSize) : '')}
          placeholder="—"
          className="h-10 w-16 rounded-lg border border-line bg-cell px-2.5 text-sm text-white focus:border-white focus:outline-none"
        />
      </label>

      <PlayerChips players={members} />

      {adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            change((g) => addPlayers(g, [newName], team.id))
            setNewName('') // поле остаётся открытым — можно сразу ввести следующего
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAdding(false)
            }}
            aria-label={`Имя нового игрока команды «${team.name}»`}
            placeholder="Имя, затем Enter"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-cell px-2.5 text-sm text-white focus:border-white focus:outline-none"
          />
          <button type="button" onClick={() => setAdding(false)} className={ghostButton}>
            Готово
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`self-start ${ghostButton}`}>
          + игрок
        </button>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => change((g) => moveTeam(g, team.id, -1))}
          disabled={index === 0}
          aria-label={`Сдвинуть команду «${team.name}» левее`}
          className={ghostButton}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => change((g) => moveTeam(g, team.id, 1))}
          disabled={index === count - 1}
          aria-label={`Сдвинуть команду «${team.name}» правее`}
          className={ghostButton}
        >
          →
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={count <= 1}
          aria-label={`Удалить команду «${team.name}»`}
          className={`ml-auto ${ghostButton}`}
        >
          Удалить
        </button>
      </div>
    </DropZone>
  )
}

// Игроки плашками: фото или инициалы, имя, «капитан». Плашку можно перетащить мышкой.
function PlayerChips({ players }: { players: Player[] }) {
  if (players.length === 0) return <span className="text-sm text-muted">Пока никого</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map((p) => (
        <span
          key={p.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', p.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          title="Перетащите в другую команду"
          className="flex cursor-grab items-center gap-1.5 rounded-full bg-cell py-1 pr-3 pl-1 text-xs"
        >
          <PlayerAvatar player={p} size={24} />
          {p.name}
          {p.locked && ' · капитан'}
        </span>
      ))}
    </div>
  )
}

// Область, куда можно бросить перетаскиваемого игрока; при наведении подсвечивается
function DropZone({ onDropPlayer, className, children }: {
  onDropPlayer: (playerId: string) => void
  className: string
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const playerId = e.dataTransfer.getData('text/plain')
        if (playerId) onDropPlayer(playerId)
      }}
      className={`${className} ${over ? 'outline-2 outline-offset-2 outline-white outline-dashed' : ''}`}
    >
      {children}
    </div>
  )
}
