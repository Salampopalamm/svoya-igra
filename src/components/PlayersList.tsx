import { useState } from 'react'
import { addMediaFile } from '../db'
import { addPlayers, namesFromText, removePlayer, updatePlayer } from '../game'
import type { Game, Player } from '../types'
import PlayerAvatar from './PlayerAvatar'

type Props = {
  game: Game
  change: (update: (g: Game) => Game) => void
  dropMedia: (...ids: string[]) => void // фото, которые больше не нужны
}

const field =
  'h-11 rounded-lg border border-line bg-cell px-3 text-sm text-white focus:border-white focus:outline-none'
const ghostButton = 'h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40'

// Левая колонка экрана «Команды и игроки»: общий список участников.
// У каждого — фото, имя, команда, «капитан» (закреплён: случайное распределение его не трогает).
export default function PlayersList({ game, change, dropMedia }: Props) {
  const [newName, setNewName] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pasted = namesFromText(pasteText)

  function addOne() {
    if (!newName.trim()) return
    change((g) => addPlayers(g, [newName]))
    setNewName('')
  }

  function addPasted() {
    change((g) => addPlayers(g, pasted))
    setPasteText('')
    setPasteOpen(false)
  }

  async function setPhoto(player: Player, file: File | undefined) {
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError(`«${file.name}» — не картинка. Для фото подойдут JPG, PNG или WEBP.`)
      return
    }
    try {
      const photo = await addMediaFile(file)
      change((g) => updatePlayer(g, player.id, (p) => ({ ...p, photo })))
      if (player.photo) dropMedia(player.photo.id) // старое фото больше не нужно
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить фото.')
    }
  }

  function remove(player: Player) {
    if (player.photo && !window.confirm(`Удалить участника «${player.name}» вместе с фото?`)) return
    change((g) => removePlayer(g, player.id))
    if (player.photo) dropMedia(player.photo.id)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted">УЧАСТНИКИ · {game.players.length}</h2>
        <button type="button" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen} className={ghostButton}>
          Вставить списком
        </button>
      </div>

      {pasteOpen && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Имена, по одному на строку. Можно скопировать столбец из Excel или Google Таблиц.
            <textarea
              autoFocus
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              className="rounded-lg border border-line bg-cell px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addPasted}
              disabled={pasted.length === 0}
              className="h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-40"
            >
              Добавить {pasted.length > 0 ? pasted.length : ''}
            </button>
            <button type="button" onClick={() => setPasteOpen(false)} className={ghostButton}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          addOne()
        }}
      >
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Новый участник
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Имя и фамилия" className={field} />
        </label>
        <button type="submit" disabled={!newName.trim()} className={`self-end ${ghostButton}`}>
          Добавить
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg border border-white px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {game.players.length > 0 && (
        <div className="grid items-center gap-2 text-xs text-muted" style={{ gridTemplateColumns: rowColumns }}>
          <span>Фото</span>
          <span>Имя</span>
          <span>Команда</span>
          <span>Закрепить</span>
          <span />
        </div>
      )}

      {game.players.map((player) => (
        <div key={player.id} className="grid items-center gap-2" style={{ gridTemplateColumns: rowColumns }}>
          <label
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full focus-within:outline-2 focus-within:outline-white"
            title={player.photo ? 'Заменить фото' : 'Добавить фото'}
          >
            {player.photo ? (
              <PlayerAvatar player={player} size={48} />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-muted text-xl text-muted">
                +
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              aria-label={`${player.photo ? 'Заменить' : 'Добавить'} фото: ${player.name}`}
              className="sr-only"
              onChange={(e) => {
                void setPhoto(player, e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          <input
            value={player.name}
            onChange={(e) => {
              const name = e.target.value
              change((g) => updatePlayer(g, player.id, (p) => ({ ...p, name })))
            }}
            onBlur={() => {
              if (!player.name.trim()) change((g) => updatePlayer(g, player.id, (p) => ({ ...p, name: 'Без имени' })))
            }}
            aria-label="Имя участника"
            className={`min-w-0 ${field}`}
          />
          <select
            value={player.teamId ?? ''}
            onChange={(e) => {
              const teamId = e.target.value || undefined
              change((g) => updatePlayer(g, player.id, (p) => ({ ...p, teamId })))
            }}
            aria-label={`Команда: ${player.name}`}
            className={`min-w-0 px-2 ${field}`}
          >
            <option value="">— без команды —</option>
            {game.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!player.locked}
              onChange={(e) => {
                const locked = e.target.checked || undefined
                change((g) => updatePlayer(g, player.id, (p) => ({ ...p, locked })))
              }}
              className="h-5 w-5 accent-white"
            />
            капитан
          </label>
          <button
            type="button"
            onClick={() => remove(player)}
            aria-label={`Удалить участника «${player.name}»`}
            className="h-11 w-11 rounded-lg border border-line text-lg hover:bg-cell"
          >
            ×
          </button>
        </div>
      ))}

      <p className="text-sm text-muted">
        {game.players.length === 0
          ? 'Добавьте участников по одному или вставьте списком. Участники не обязательны: можно играть просто командами.'
          : 'Клик по кружку — загрузить или заменить фото. «Капитан» остаётся в своей команде при случайном распределении.'}
      </p>
    </section>
  )
}

const rowColumns = '48px minmax(0, 1fr) minmax(0, 150px) 104px 44px'
