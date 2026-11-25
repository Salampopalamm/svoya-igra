import { correctPoints, wrongPoints } from '../special'
import type { Question, Team } from '../types'
import TeamIcon from './TeamIcon'

// Вопрос «для всех команд» на пульте: каждая команда пишет ответ (на бумажке), ведущий отмечает верно / неверно.
// Без отметки — команда не ответила, счёт не меняется. «Подвести итог» начисляет баллы и закрывает вопрос.

type Props = {
  question: Question
  teams: Team[]
  marks: Record<string, boolean>
  onMark: (teamId: string, correct: boolean) => void
  onReveal: () => void
  onClose: () => void
}

export default function AllAnswers({ question, teams, marks, onMark, onReveal, onClose }: Props) {
  const plus = correctPoints(question)
  const minus = wrongPoints(question)
  const marked = teams.filter((t) => marks[t.id] !== undefined).length
  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="text-xl font-semibold" aria-live="polite">
        Отвечают все команды. Отметьте, кто ответил верно, — потом «Подвести итог»
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 5)}, 1fr)` }}>
        {teams.map((team) => {
          const mark = marks[team.id]
          return (
            <div key={team.id} className={`flex flex-col gap-2 rounded-xl p-4 ${mark === undefined ? 'border border-line' : 'border-2 border-white bg-cell'}`}>
              <span className="flex min-h-11 items-center gap-2 font-semibold">
                <TeamIcon team={team} size={28} />
                {team.name}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onMark(team.id, true)}
                  aria-pressed={mark === true}
                  className={`h-11 flex-1 rounded-lg font-semibold ${mark === true ? 'bg-white text-black' : 'border border-white hover:bg-cell'}`}
                >
                  Верно +{plus}
                </button>
                <button
                  type="button"
                  onClick={() => onMark(team.id, false)}
                  aria-pressed={mark === false}
                  className={`h-11 flex-1 rounded-lg ${mark === false ? 'bg-white font-semibold text-black' : 'border border-white hover:bg-cell'}`}
                >
                  {minus ? `Неверно −${minus}` : 'Неверно · 0'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={onReveal} className="h-12 rounded-lg bg-white px-6 font-semibold text-black hover:opacity-90">
          Подвести итог{marked ? ` · отмечено ${marked} из ${teams.length}` : ' · никто не ответил'}
        </button>
        <button type="button" onClick={onClose} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
          Закрыть без баллов · Esc
        </button>
        <span className="text-sm text-muted">Без отметки — команда не ответила, счёт не меняется. Нажмите отметку ещё раз, чтобы снять.</span>
      </div>
    </div>
  )
}
