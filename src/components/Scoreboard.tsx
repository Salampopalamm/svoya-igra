import { useRef, useState } from 'react'
import type { Player, Team } from '../types'
import PlayerAvatar from './PlayerAvatar'
import AnimatedScore from './AnimatedScore'
import TeamIcon from './TeamIcon'

type Props = {
  teams: Team[]
  players?: Player[] // на пульте — показать игроков каждой команды
  activeTeamId?: string | null // подсветить команду: чей ход (на табло) или кто отвечает (в вопросе)
  activeLabel?: string // подпись у подсвеченной команды: «ХОД», «ОТВЕЧАЕТ», «ПЕРЕХВАТ»
  outTeamIds?: string[] // ошиблись на этом вопросе — показаны бледно
  // Только на пульте: номер команды — кнопка (передать ход / выбрать, кто отвечает)
  onPickTeam?: (teamId: string) => void
  pickLabel?: string // подсказка к этой кнопке, например «Передать ход команде»
  // Только на пульте: ручная правка счёта (в зале кнопок нет)
  onAdjust?: (teamId: string, delta: number) => void // кнопки − / +
  onSetScore?: (teamId: string, score: number) => void // вписать счёт целиком
  step?: number // на сколько баллов меняет одно нажатие − / +
}

// Счёт команд внизу экрана (компактный вид: номер, название, очки).
export default function Scoreboard({
  teams,
  players = [],
  activeTeamId,
  activeLabel,
  outTeamIds = [],
  onPickTeam,
  pickLabel = 'Выбрать команду',
  onAdjust,
  onSetScore,
  step = 100,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null) // у какой команды сейчас вписывают счёт

  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 5)}, 1fr)` }}>
      {teams.map((team, i) => {
        const active = team.id === activeTeamId
        const out = outTeamIds.includes(team.id)
        const numberClass = `flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg ${active ? 'bg-accent text-on-accent' : 'border-2 border-white'}`
        const number = i === 9 ? 0 : i + 1
        return (
          <div
            key={team.id}
            className={`flex flex-col gap-2 rounded-xl px-5 py-3 ${active ? 'border-[3px] border-accent bg-cell' : 'border border-line'} ${out ? 'opacity-40' : ''}`}
          >
            <div className="flex items-center gap-4">
              {onPickTeam ? (
                <button
                  type="button"
                  onClick={() => onPickTeam(team.id)}
                  disabled={out}
                  aria-label={`${pickLabel} «${team.name}» (клавиша ${number})`}
                  title={`${pickLabel} «${team.name}»`}
                  className={`${numberClass} hover:bg-white hover:text-black`}
                >
                  {number}
                </button>
              ) : (
                <span className={numberClass}>{number}</span>
              )}
              <TeamIcon team={team} size={36} />
              <span className="flex-1 text-lg font-semibold">
                {team.name}
                {active && activeLabel && (
                  <span className="ml-2 rounded bg-accent px-2 py-0.5 align-middle text-xs text-on-accent">{activeLabel}</span>
                )}
                {out && <span className="ml-2 align-middle text-xs text-muted">ошиблись</span>}
              </span>
              {onSetScore && editingId === team.id ? (
                <ScoreInput
                  initial={team.score}
                  onDone={(score) => {
                    if (score !== null && score !== team.score) onSetScore(team.id, score)
                    setEditingId(null)
                  }}
                />
              ) : onSetScore ? (
                <button
                  type="button"
                  onClick={() => setEditingId(team.id)}
                  title="Нажмите, чтобы вписать счёт"
                  aria-label={`Вписать счёт команды «${team.name}», сейчас ${team.score}`}
                  className="min-h-11 min-w-11 rounded-lg px-2 font-display text-2xl hover:bg-cell"
                >
                  {team.score}
                </button>
              ) : (
                <AnimatedScore value={team.score} className="font-display text-2xl" />
              )}
            </div>
            {players.some((p) => p.teamId === team.id) && (
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5">
                {players
                  .filter((p) => p.teamId === team.id)
                  .map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5 text-xs">
                      <PlayerAvatar player={p} size={28} />
                      {p.name.split(/\s+/)[0]}
                    </span>
                  ))}
              </div>
            )}
            {onAdjust && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAdjust(team.id, -step)}
                  aria-label={`Снять ${step} у команды «${team.name}»`}
                  className="h-11 flex-1 rounded-lg border border-line text-sm hover:bg-cell"
                >
                  −{step}
                </button>
                <button
                  type="button"
                  onClick={() => onAdjust(team.id, step)}
                  aria-label={`Добавить ${step} команде «${team.name}»`}
                  className="h-11 flex-1 rounded-lg border border-line text-sm hover:bg-cell"
                >
                  +{step}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Поле для ввода счёта: Enter или клик мимо — сохранить, Esc — отменить.
function ScoreInput({ initial, onDone }: { initial: number; onDone: (score: number | null) => void }) {
  const [text, setText] = useState(String(initial))
  const doneRef = useRef(false) // чтобы Enter и потеря фокуса не сработали дважды

  function close(score: number | null) {
    if (doneRef.current) return
    doneRef.current = true
    onDone(score)
  }

  function finish() {
    const value = Number(text.trim().replace('−', '-'))
    close(text.trim() !== '' && Number.isInteger(value) ? value : null)
  }

  return (
    <input
      autoFocus
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish()
        if (e.key === 'Escape') close(null)
      }}
      aria-label="Счёт команды"
      className="h-11 w-28 rounded-lg border-2 border-white bg-bg px-2 text-right font-display text-2xl text-white outline-none"
    />
  )
}
