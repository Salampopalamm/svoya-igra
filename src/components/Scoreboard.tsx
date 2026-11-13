import { useRef, useState } from 'react'
import type { Team } from '../types'

type Props = {
  teams: Team[]
  answeringTeamId?: string | null // подсветить отвечающую команду
  // Только на пульте: ручная правка счёта (в зале кнопок нет)
  onAdjust?: (teamId: string, delta: number) => void // кнопки − / +
  onSetScore?: (teamId: string, score: number) => void // вписать счёт целиком
  step?: number // на сколько баллов меняет одно нажатие − / +
}

// Счёт команд внизу экрана (компактный вид: номер, название, очки).
export default function Scoreboard({ teams, answeringTeamId, onAdjust, onSetScore, step = 100 }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null) // у какой команды сейчас вписывают счёт

  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 5)}, 1fr)` }}>
      {teams.map((team, i) => {
        const answering = team.id === answeringTeamId
        return (
          <div
            key={team.id}
            className={`flex flex-col gap-2 rounded-xl px-5 py-3 ${answering ? 'border-[3px] border-white bg-cell' : 'border border-line'}`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg ${answering ? 'bg-white text-black' : 'border-2 border-white'}`}
              >
                {i === 9 ? 0 : i + 1}
              </span>
              <span className="flex-1 text-lg font-semibold">{team.name}</span>
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
                <span className="font-display text-2xl">{team.score}</span>
              )}
            </div>
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
